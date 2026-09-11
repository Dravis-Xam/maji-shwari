import { createSession, sessionCookie, type Role } from '../_lib/auth'
import { json, methodNotAllowed } from '../_lib/http'

const env = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}

const roles: Role[] = ['community', 'government', 'donor']
export default async function handler(request: Request) {
  if (env.NODE_ENV === 'production') return json({ error: 'Use Google sign-in.' }, { status: 410 })
  if (request.method !== 'POST') return methodNotAllowed(['POST'])
  let body: { name?: string; role?: Role }
  try { body = await request.json() } catch { return json({ error: 'Invalid JSON body' }, { status: 400 }) }
  const role = body.role
  const name = String(body.name ?? '').trim().slice(0, 80)
  if (!role || !roles.includes(role) || name.length < 2) return json({ error: 'Name and a valid role are required.' }, { status: 422 })
  const token = await createSession({ sub: `${role}:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name, email: `${role}@local.invalid`, role })
  return json({ user: { name, role } }, { headers: { 'set-cookie': sessionCookie(token), 'cache-control': 'no-store' } })
}
