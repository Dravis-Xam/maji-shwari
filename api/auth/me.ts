import { googleRoles, readPendingSession, readSession } from '../_lib/auth'
import { json } from '../_lib/http'
export default async function handler(request: Request) {
  const user = await readSession(request)
  if (user) return json({ user }, { headers: { 'cache-control': 'no-store' } })
  const pending = await readPendingSession(request)
  if (pending) return json({ user: { ...pending, role: 'pending' }, availableRoles: googleRoles(pending.email) }, { headers: { 'cache-control': 'no-store' } })
  return json({ user: null }, { status: 401, headers: { 'cache-control': 'no-store' } })
}
