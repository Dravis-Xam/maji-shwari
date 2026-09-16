import { authorizeChannel, channelForUser, hasPusher, notifyUser } from './_lib/pusher'
import { ensureSchema, hasDatabase, sql } from './_lib/db'
import { json } from './_lib/http'
import { readSession } from './_lib/auth'
import type { Notification } from './_lib/pusher'

// On Vercel's Node.js runtime, request.url is not always guaranteed to be
// an absolute URL — it can arrive as just a path (e.g. via a rewrite),
// which makes `new URL(request.url)` throw "Invalid URL". Fall back to
// building it from the host header when that happens.
function requestUrl(request: Request) {
  try {
    return new URL(request.url)
  } catch {
    const host =
      request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? 'localhost'
    const protocol = request.headers.get('x-forwarded-proto') ?? 'https'
    return new URL(request.url, `${protocol}://${host}`)
  }
}

type NotificationRow = {
  id: number
  title: string
  message: string
  read_at: string | null
  created_at: string
}

// Single entry point for /api/notifications, /api/notifications/:id,
// /api/notifications/test, and /api/pusher/auth. vercel.json rewrites:
//   /api/notifications/:id -> /api/notifications?id=:id
//   /api/pusher/auth       -> /api/notifications?action=pusher-auth
// This folds what used to be four separate serverless functions
// (pusher/auth.ts, notifications/index.ts, notifications/[id].ts,
// notifications/test.ts) into one, with no frontend changes needed.

// ---- GET /api/notifications (list) ----
export async function GET(request: Request) {
  const session = await readSession(request)
  if (!session) return json({ error: 'Authentication required' }, { status: 401 })
  if (!hasDatabase()) return json({ notifications: [] as Notification[], source: 'demo' })

  try {
    await ensureSchema()
    const query = sql()
    const rows = (await query`
      SELECT id, title, message, read_at, created_at
      FROM notifications
      WHERE user_sub = ${session.sub}
      ORDER BY created_at DESC
      LIMIT 50
    `) as unknown as NotificationRow[]

    const notifications: Notification[] = rows.map((row) => ({
      id: String(row.id),
      title: row.title,
      message: row.message,
      read: row.read_at !== null,
      createdAt: row.created_at,
    }))

    return json({ notifications, source: 'neon' })
  } catch (error) {
    console.error('notifications_read_failed', error)
    return json({ notifications: [] as Notification[], source: 'demo' })
  }
}

// ---- POST: either /api/pusher/auth or /api/notifications/test ----
export async function POST(request: Request) {
  const url = requestUrl(request)
  const action = url.searchParams.get('action')
  const id = url.searchParams.get('id')

  if (action === 'pusher-auth') return pusherAuth(request)
  if (id === 'test') return testNotification(request)

  return json({ error: 'Unknown notifications action.' }, { status: 404 })
}

// ---- PATCH /api/notifications/:id (mark read) ----
export async function PATCH(request: Request) {
  const session = await readSession(request)
  if (!session) return json({ error: 'Authentication required' }, { status: 401 })

  const id = requestUrl(request).searchParams.get('id')
  if (!id) return json({ error: 'Notification id is required.' }, { status: 400 })
  if (!hasDatabase()) return json({ ok: true })

  try {
    await ensureSchema()
    const query = sql()
    await query`
      UPDATE notifications
      SET read_at = COALESCE(read_at, NOW())
      WHERE id = ${id} AND user_sub = ${session.sub}
    `
    return json({ ok: true })
  } catch (error) {
    console.error('notification_update_failed', error)
    return json({ error: 'Could not update notification.' }, { status: 503 })
  }
}

// ---- DELETE: /api/notifications (clear all) or /api/notifications/:id (dismiss one) ----
export async function DELETE(request: Request) {
  const session = await readSession(request)
  if (!session) return json({ error: 'Authentication required' }, { status: 401 })

  const id = requestUrl(request).searchParams.get('id')

  if (!id) {
    if (!hasDatabase()) return json({ ok: true })
    try {
      await ensureSchema()
      const query = sql()
      await query`DELETE FROM notifications WHERE user_sub = ${session.sub}`
      return json({ ok: true })
    } catch (error) {
      console.error('notifications_clear_failed', error)
      return json({ error: 'Could not clear notifications.' }, { status: 503 })
    }
  }

  if (!hasDatabase()) return json({ ok: true })
  try {
    await ensureSchema()
    const query = sql()
    await query`DELETE FROM notifications WHERE id = ${id} AND user_sub = ${session.sub}`
    return json({ ok: true })
  } catch (error) {
    console.error('notification_delete_failed', error)
    return json({ error: 'Could not remove notification.' }, { status: 503 })
  }
}

// ---- Pusher private-channel auth (was api/pusher/auth.ts) ----
async function pusherAuth(request: Request) {
  if (!hasPusher())
    return json({ error: 'Realtime notifications are not configured.' }, { status: 503 })

  const session = await readSession(request)
  if (!session) return json({ error: 'Authentication required' }, { status: 401 })

  let body: { socket_id?: string; channel_name?: string }
  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    try {
      body = await request.json()
    } catch {
      return json({ error: 'Invalid JSON body' }, { status: 400 })
    }
  } else {
    const form = await request.formData()
    body = {
      socket_id: String(form.get('socket_id') ?? ''),
      channel_name: String(form.get('channel_name') ?? ''),
    }
  }

  if (!body.socket_id || !body.channel_name) {
    return json({ error: 'socket_id and channel_name are required' }, { status: 400 })
  }

  // Only ever authorize a user for their own notification channel — never
  // whatever channel name the client happens to ask for.
  if (body.channel_name !== channelForUser(session.sub)) {
    return json({ error: 'Not authorized for this channel' }, { status: 403 })
  }

  const authResponse = authorizeChannel(body.socket_id, body.channel_name)
  return json(authResponse)
}

// ---- Test notification (was api/notifications/test.ts) ----
async function testNotification(request: Request) {
  const session = await readSession(request)
  if (!session) return json({ error: 'Authentication required' }, { status: 401 })

  const notification = await notifyUser({
    userSub: session.sub,
    title: 'Test notification',
    message: `Hi ${session.name}, this confirms your realtime notifications are wired up correctly.`,
  })

  return json({
    notification,
    pushed: hasPusher(),
    note: hasPusher()
      ? 'Sent live over Pusher.'
      : 'Pusher is not configured — saved to the database only, not pushed live. Set PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER to enable live push.',
  })
}