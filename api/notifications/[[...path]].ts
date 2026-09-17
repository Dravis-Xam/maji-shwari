import { hasDatabase, ensureSchema, sql } from '../_lib/db'
import { json } from '../_lib/http'
import { readSession } from '../_lib/auth'
import { hasPusher, notifyUser } from '../_lib/pusher'
import type { Notification } from '../_lib/pusher'

type NotificationRow = {
  id: number
  title: string
  message: string
  read_at: string | null
  created_at: string
}

// Single entry point for /api/notifications, /api/notifications/:id, and
// /api/notifications/test. This is a native Vercel optional catch-all
// route (the [[...path]] filename), not a vercel.json rewrite — a rewrite
// was found to hand this function a malformed request, so this reads the
// id/action straight from the genuine request path instead. Folding these
// into one file saves two of the twelve Hobby-plan serverless function
// slots. (Pusher's own /api/pusher/auth stays a separate file — it's
// called directly by the Pusher client and gains nothing from merging.)
function segmentFromUrl(request: Request) {
  const segments = new URL(request.url).pathname.split('/')
  const last = segments[segments.length - 1]
  return last === 'notifications' ? null : last
}

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

// ---- POST /api/notifications/test ----
export async function POST(request: Request) {
  const segment = segmentFromUrl(request)
  if (segment !== 'test') return json({ error: 'Unknown notifications action.' }, { status: 404 })

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

// ---- PATCH /api/notifications/:id (mark read) ----
export async function PATCH(request: Request) {
  const session = await readSession(request)
  if (!session) return json({ error: 'Authentication required' }, { status: 401 })

  const id = segmentFromUrl(request)
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

  const id = segmentFromUrl(request)

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