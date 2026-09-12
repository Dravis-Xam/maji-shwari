import { clearSessionCookie } from '../_lib/auth'
import { json } from '../_lib/http'

export function POST() {
  return json(
    { ok: true },
    {
      headers: {
        'set-cookie': clearSessionCookie(),
        'cache-control': 'no-store',
      },
    },
  )
}