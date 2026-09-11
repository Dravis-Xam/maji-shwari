import { clearPendingCookie, createSession, googleRole, readPendingSession, sessionCookie } from '../_lib/auth'
import { json, methodNotAllowed } from '../_lib/http'

const env = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}

export default async function handler(request: Request) {
  if (request.method !== 'POST') return methodNotAllowed(['POST'])
  let body: { name?: string; role?: 'community' | 'government' | 'donor'; action?: 'role' }
  try { body = await request.json() } catch { return json({ error: 'Invalid JSON body' }, { status: 400 }) }
  if (body.action === 'role') {
    const pending = await readPendingSession(request)
    if (!pending) return json({ error: 'Google onboarding session expired. Sign in again.' }, { status: 401 })
    if (!body.role || googleRole(pending.email) !== body.role) return json({ error: 'That role is not approved for this Google account.' }, { status: 403 })
    const token = await createSession({ ...pending, role: body.role })
    const headers = new Headers({ 'cache-control': 'no-store' })
    headers.append('set-cookie', sessionCookie(token))
    headers.append('set-cookie', clearPendingCookie())
    return json({ user: { ...pending, role: body.role } }, { headers })
  }
  if (env.NODE_ENV === 'production') return json({ error: 'Use Google sign-in.' }, { status: 410 })
  const name = String(body.name ?? '').trim().slice(0, 80)
  if (name.length < 2) return json({ error: 'Name is required.' }, { status: 422 })
  const role = 'community' as const
  const token = await createSession({ sub: `local:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name, email: 'local-preview@local.invalid', role })
  return json({ user: { name, role } }, { headers: { 'set-cookie': sessionCookie(token), 'cache-control': 'no-store' } })
}
