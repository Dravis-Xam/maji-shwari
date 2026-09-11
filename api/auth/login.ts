import { createSession, sessionCookie } from '../_lib/auth'
import { json, methodNotAllowed } from '../_lib/http'

const env = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}

export default async function handler(request: Request) {
  if (env.NODE_ENV === 'production') return json({ error: 'Use Google sign-in.' }, { status: 410 })
  if (request.method !== 'POST') return methodNotAllowed(['POST'])
  let body: { name?: string }
  try { body = await request.json() } catch { return json({ error: 'Invalid JSON body' }, { status: 400 }) }
  const name = String(body.name ?? '').trim().slice(0, 80)
  if (name.length < 2) return json({ error: 'Name is required.' }, { status: 422 })
  const role = 'community' as const
  const token = await createSession({ sub: `local:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name, email: 'local-preview@local.invalid', role })
  return json({ user: { name, role } }, { headers: { 'set-cookie': sessionCookie(token), 'cache-control': 'no-store' } })
}
