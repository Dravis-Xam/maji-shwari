import { json } from '../_lib/http'
import { readSession } from '../_lib/auth'
import { notifyUser, hasPusher } from '../_lib/pusher'

export async function POST(request: Request) {
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