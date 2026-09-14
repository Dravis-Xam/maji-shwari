import { hasDatabase, ensureSchema, sql } from '../_lib/db'
import { json } from '../_lib/http'
import { readSession } from '../_lib/auth'

function idFromUrl(request: Request) {
  const segments = new URL(request.url).pathname.split('/')
  return segments[segments.length - 1]
}

export async function PATCH(request: Request) {
  const session = await readSession(request)
  if (!session) return json({ error: 'Authentication required' }, { status: 401 })

  const id = idFromUrl(request)
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

export async function DELETE(request: Request) {
  const session = await readSession(request)
  if (!session) return json({ error: 'Authentication required' }, { status: 401 })

  const id = idFromUrl(request)
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