export type Role = 'community' | 'government' | 'donor'
export type Session = { sub: string; name: string; email: string; role: Role }
const COOKIE = 'maji_session'
const PENDING_COOKIE = 'maji_pending'
const env =
  (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } })
    .process?.env ?? {}

function secret() {
  if (env.NODE_ENV === 'production' && !env.JWT_SECRET)
    throw new Error('JWT_SECRET is required in production')
  return new TextEncoder().encode(env.JWT_SECRET || 'local-development-secret-change-me')
}

function encode(value: string) {
  return btoa(value).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function decode(value: string) {
  return atob(
    value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (value.length % 4)) % 4),
  )
}

async function signJwt(payload: Record<string, unknown>, lifetimeSeconds: number) {
  const header = encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = encode(
    JSON.stringify({
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + lifetimeSeconds,
    }),
  )
  const data = new TextEncoder().encode(`${header}.${body}`)
  const key = await crypto.subtle.importKey(
    'raw',
    secret(),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = encode(
    String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', key, data))),
  )
  return `${header}.${body}.${signature}`
}

async function verifyJwt(token: string) {
  const [header, body, signature] = token.split('.')
  if (!header || !body || !signature) throw new Error('Malformed token')
  const key = await crypto.subtle.importKey(
    'raw',
    secret(),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    Uint8Array.from(decode(signature), (character) => character.charCodeAt(0)),
    new TextEncoder().encode(`${header}.${body}`),
  )
  const payload = JSON.parse(decode(body)) as Record<string, unknown>
  if (!valid || Number(payload.exp) < Math.floor(Date.now() / 1000))
    throw new Error('Invalid token')
  return payload
}

export async function createSignedState(origin: string) {
  return signJwt({ origin }, 10 * 60)
}

export async function createPendingSession(session: Omit<Session, 'role'>) {
  return signJwt({ ...session, pending: true }, 10 * 60)
}

export async function readPendingSession(request: Request): Promise<Omit<Session, 'role'> | null> {
  const token = request.headers
    .get('cookie')
    ?.split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${PENDING_COOKIE}=`))
    ?.slice(PENDING_COOKIE.length + 1)
  if (!token) return null
  try {
    const payload = await verifyJwt(token)
    if (payload.pending !== true) return null
    return { sub: String(payload.sub), name: String(payload.name), email: String(payload.email) }
  } catch {
    return null
  }
}

export function pendingCookie(token: string) {
  return `${PENDING_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${env.NODE_ENV === 'production' ? '; Secure' : ''}`
}

export function clearPendingCookie() {
  return `${PENDING_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}

export async function verifySignedState(token: string) {
  return verifyJwt(token)
}

export async function createSession(session: Session) {
  return signJwt(session, 8 * 60 * 60)
}

export async function readSession(request: Request): Promise<Session | null> {
  const token = request.headers
    .get('cookie')
    ?.split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1)
  if (!token) return null
  try {
    const payload = await verifyJwt(token)
    if (payload.role !== 'community' && payload.role !== 'government' && payload.role !== 'donor')
      return null
    return {
      sub: String(payload.sub),
      name: String(payload.name),
      email: String(payload.email),
      role: payload.role,
    }
  } catch {
    return null
  }
}

export function sessionCookie(token: string) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800${env.NODE_ENV === 'production' ? '; Secure' : ''}`
}

export function clearSessionCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}

export function canCreateProject(role: Role) {
  return role === 'community' || role === 'government'
}
export function canRequestFunding(role: Role) {
  return role === 'community' || role === 'government'
}
export function canDonate(role: Role) {
  return role === 'donor'
}

export function googleRole(email: string): Role | null {
  const normalized = email.toLowerCase()
  const list = (key: string) =>
    (env[key] ?? '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  if (list('GOOGLE_GOVERNMENT_EMAILS').includes(normalized)) return 'government'
  if (list('GOOGLE_DONOR_EMAILS').includes(normalized)) return 'donor'
  if (list('GOOGLE_COMMUNITY_EMAILS').includes(normalized)) return 'community'
  return null
}

export function googleRoles(email: string): Role[] {
  const normalized = email.toLowerCase()
  const list = (key: string) =>
    (env[key] ?? '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  return (['community', 'government', 'donor'] as Role[]).filter((role) =>
    list(`GOOGLE_${role.toUpperCase()}_EMAILS`).includes(normalized),
  )
}

export async function requireSession(request: Request) {
  const session = await readSession(request)
  return session
    ? { session }
    : {
        response: new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
      }
}