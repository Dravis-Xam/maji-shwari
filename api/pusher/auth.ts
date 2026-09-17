import { authorizeChannel, channelForUser, hasPusher } from '../_lib/pusher'
import { json } from '../_lib/http'
import { readSession } from '../_lib/auth'

export async function POST(request: Request) {
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