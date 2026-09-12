import { ALL_ROLES, readPendingSession, readSession, readVerificationSession } from '../_lib/auth'
import { json } from '../_lib/http'

export async function GET(request: Request) {
  const user = await readSession(request)
  if (user) {
    return json({ user }, { headers: { 'cache-control': 'no-store' } })
  }

  const verification = await readVerificationSession(request)
  if (verification) {
    return json(
      {
        user: {
          sub: verification.sub,
          name: verification.name,
          email: verification.email,
          role: 'verifying',
        },
      },
      { headers: { 'cache-control': 'no-store' } },
    )
  }

  const pending = await readPendingSession(request)
  if (pending) {
    return json(
      { user: { ...pending, role: 'pending' }, availableRoles: ALL_ROLES },
      { headers: { 'cache-control': 'no-store' } },
    )
  }

  return json({ user: null }, { status: 401, headers: { 'cache-control': 'no-store' } })
}