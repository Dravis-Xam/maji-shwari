import { clearSessionCookie } from '../_lib/auth'
import { json, methodNotAllowed } from '../_lib/http'
export default function handler(request: Request) {
  if (request.method !== 'POST') return methodNotAllowed(['POST'])
  return json({ ok: true }, { headers: { 'set-cookie': clearSessionCookie(), 'cache-control': 'no-store' } })
}
