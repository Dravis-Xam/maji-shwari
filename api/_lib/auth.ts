export type Role = 'community' | 'government' | 'donor'
export type Session = { sub: string; name: string; email: string; role: Role }
const COOKIE = 'maji_session'
const PENDING_COOKIE = 'maji_pending'
const VERIFY_COOKIE = 'maji_verify'
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

export function generateCode() {
  const bytes = new Uint32Array(1)
  crypto.getRandomValues(bytes)
  return String(bytes[0] % 1000000).padStart(6, '0')
}

export async function hashCode(code: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code))
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
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

export type PendingVerification = {
  sub: string
  name: string
  email: string
  role: Role
  codeHash: string
  attempts: number
}

export async function createVerificationSession(
  session: { sub: string; name: string; email: string; role: Role },
  codeHash: string,
  attempts = 0,
) {
  return signJwt({ ...session, verify: true, codeHash, attempts }, 10 * 60)
}

export async function readVerificationSession(
  request: Request,
): Promise<PendingVerification | null> {
  const token = request.headers
    .get('cookie')
    ?.split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${VERIFY_COOKIE}=`))
    ?.slice(VERIFY_COOKIE.length + 1)
  if (!token) return null
  try {
    const payload = await verifyJwt(token)
    if (payload.verify !== true) return null
    return {
      sub: String(payload.sub),
      name: String(payload.name),
      email: String(payload.email),
      role: payload.role as Role,
      codeHash: String(payload.codeHash),
      attempts: Number(payload.attempts) || 0,
    }
  } catch {
    return null
  }
}

export function verificationCookie(token: string) {
  return `${VERIFY_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${env.NODE_ENV === 'production' ? '; Secure' : ''}`
}

export function clearVerificationCookie() {
  return `${VERIFY_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
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

export const ALL_ROLES: Role[] = ['community', 'government', 'donor']

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