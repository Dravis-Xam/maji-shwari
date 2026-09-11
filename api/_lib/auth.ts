import { jwtVerify, SignJWT } from 'jose'

export type Role = 'community' | 'government' | 'donor'
export type Session = { sub: string; name: string; email: string; role: Role }
const COOKIE = 'maji_session'
const env = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}

function secret() {
  if (env.NODE_ENV === 'production' && !env.JWT_SECRET) throw new Error('JWT_SECRET is required in production')
  return new TextEncoder().encode(env.JWT_SECRET || 'local-development-secret-change-me')
}

export async function createSession(session: Session) {
  return new SignJWT(session).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('8h').sign(secret())
}

export async function readSession(request: Request): Promise<Session | null> {
  const token = request.headers.get('cookie')?.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1)
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret())
    if (payload.role !== 'community' && payload.role !== 'government' && payload.role !== 'donor') return null
    return { sub: String(payload.sub), name: String(payload.name), email: String(payload.email), role: payload.role }
  } catch { return null }
}

export function sessionCookie(token: string) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800${env.NODE_ENV === 'production' ? '; Secure' : ''}`
}

export function clearSessionCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}

export function canCreateProject(role: Role) { return role === 'community' || role === 'government' }
export function canRequestFunding(role: Role) { return role === 'community' || role === 'government' }
export function canDonate(role: Role) { return role === 'donor' }

export function googleRole(email: string): Role | null {
  const normalized = email.toLowerCase()
  const list = (key: string) => (env[key] ?? '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean)
  if (list('GOOGLE_GOVERNMENT_EMAILS').includes(normalized)) return 'government'
  if (list('GOOGLE_DONOR_EMAILS').includes(normalized)) return 'donor'
  if (list('GOOGLE_COMMUNITY_EMAILS').includes(normalized)) return 'community'
  return null
}

export async function requireSession(request: Request) {
  const session = await readSession(request)
  return session ? { session } : { response: new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: { 'content-type': 'application/json' } }) }
}
