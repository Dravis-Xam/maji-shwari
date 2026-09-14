import Pusher from 'pusher'
import { hasDatabase, sql } from './db'

const env =
  (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } })
    .process?.env ?? {}

let client: Pusher | undefined

export function hasPusher() {
  return Boolean(env.PUSHER_APP_ID && env.PUSHER_KEY && env.PUSHER_SECRET && env.PUSHER_CLUSTER)
}

function pusher() {
  if (!hasPusher()) throw new Error('Pusher is not configured')
  client ??= new Pusher({
    appId: env.PUSHER_APP_ID!,
    key: env.PUSHER_KEY!,
    secret: env.PUSHER_SECRET!,
    cluster: env.PUSHER_CLUSTER!,
    useTLS: true,
  })
  return client
}

export function channelForUser(userSub: string) {
  // Pusher channel names can't contain ':' (present in subs like "google:123").
  return `private-user-${userSub.replace(/[^a-zA-Z0-9_=@,.;-]/g, '_')}`
}

export function authorizeChannel(socketId: string, channel: string) {
  return pusher().authorizeChannel(socketId, channel)
}

export type NotificationInput = { userSub: string; title: string; message: string }
export type Notification = {
  id: string
  title: string
  message: string
  read: boolean
  createdAt: string
}

/**
 * Persists a notification (when a database is configured) and pushes it live
 * over Pusher to the user's private channel. Safe to call even when Pusher or
 * the database aren't configured — it just does whichever parts it can.
 */
export async function notifyUser(input: NotificationInput): Promise<Notification> {
  let notification: Notification = {
    id: `local-${Date.now()}`,
    title: input.title,
    message: input.message,
    read: false,
    createdAt: new Date().toISOString(),
  }

  if (hasDatabase()) {
    try {
      const query = sql()
      const rows = (await query`
        INSERT INTO notifications (user_sub, title, message)
        VALUES (${input.userSub}, ${input.title}, ${input.message})
        RETURNING id, title, message, read_at, created_at
      `) as unknown as Array<{
        id: number
        title: string
        message: string
        read_at: string | null
        created_at: string
      }>
      const row = rows[0]
      if (row) {
        notification = {
          id: String(row.id),
          title: row.title,
          message: row.message,
          read: row.read_at !== null,
          createdAt: row.created_at,
        }
      }
    } catch (error) {
      console.error('notification_persist_failed', error)
    }
  }

  if (hasPusher()) {
    try {
      await pusher().trigger(channelForUser(input.userSub), 'notification', notification)
    } catch (error) {
      console.error('notification_push_failed', error)
    }
  }

  return notification
}