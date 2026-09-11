import { readSession } from '../_lib/auth'
import { json } from '../_lib/http'
export default async function handler(request: Request) {
  const user = await readSession(request)
  return user ? json({ user }, { headers: { 'cache-control': 'no-store' } }) : json({ user: null }, { status: 401, headers: { 'cache-control': 'no-store' } })
}
