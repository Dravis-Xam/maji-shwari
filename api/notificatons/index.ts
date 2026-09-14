import { hasDatabase, ensureSchema, sql } from '../_lib/db'
import { json } from '../_lib/http'
import { readSession } from '../_lib/auth'
import type { Notification } from '../_lib/pusher'

type NotificationRow = {
  id: number
  title: string
  message: string
  read_at: string | null
  created_at: string
}

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

export async function DELETE(request: Request) {
  const session = await readSession(request)
  if (!session) return json({ error: 'Authentication required' }, { status: 401 })
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