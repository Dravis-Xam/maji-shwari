import {
  clearPendingCookie,
  clearSessionCookie,
  createPendingSession,
  createSession,
  createSignedState,
  googleRoles,
  pendingCookie,
  readPendingSession,
  readSession,
  sessionCookie,
  verifySignedState,
} from '../_lib/auth'
import { json, methodNotAllowed } from '../_lib/http'

const env =
  (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } })
    .process?.env ?? {}

function actionFromUrl(request: Request) {
  const segments = new URL(request.url).pathname.split('/')
  return segments[segments.length - 1]
}

// Single entry point for /api/auth/login, /api/auth/logout, /api/auth/me,
// and /api/auth/google. This is a native Vercel dynamic route (the [action]
// filename), NOT a vercel.json rewrite — a rewrite was found to hand this
// function a malformed request (relative request.url, headers without a
// real Headers instance), so this reads the action straight from the
// genuine request path instead. Folding these into one file still saves
// three of the twelve Hobby-plan serverless function slots.
export default async function handler(request: Request) {
  switch (actionFromUrl(request)) {
    case 'login':
      return login(request)
    case 'logout':
      return logout(request)
    case 'me':
      return me(request)
    case 'google':
      return google(request)
    default:
      return json({ error: 'Unknown auth action.' }, { status: 404 })
  }
}

// ---- /api/auth/login ----
async function login(request: Request) {
  if (request.method !== 'POST') return methodNotAllowed(['POST'])

  let body: { name?: string; role?: 'community' | 'government' | 'donor'; action?: 'role' }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (body.action === 'role') {
    const pending = await readPendingSession(request)
    if (!pending)
      return json({ error: 'Google onboarding session expired. Sign in again.' }, { status: 401 })
    if (!body.role || !googleRoles(pending.email).includes(body.role)) {
      return json({ error: 'That role is not approved for this Google account.' }, { status: 403 })
    }
    const token = await createSession({ ...pending, role: body.role })
    const headers = new Headers({ 'cache-control': 'no-store' })
    headers.append('set-cookie', sessionCookie(token))
    headers.append('set-cookie', clearPendingCookie())
    return json({ user: { ...pending, role: body.role } }, { headers })
  }

  if (env.NODE_ENV === 'production') return json({ error: 'Use Google sign-in.' }, { status: 410 })

  const name = String(body.name ?? '')
    .trim()
    .slice(0, 80)
  if (name.length < 2) return json({ error: 'Name is required.' }, { status: 422 })

  const role = 'community' as const
  const token = await createSession({
    sub: `local:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name,
    email: 'local-preview@local.invalid',
    role,
  })
  return json(
    { user: { name, role } },
    { headers: { 'set-cookie': sessionCookie(token), 'cache-control': 'no-store' } },
  )
}

// ---- /api/auth/logout ----
async function logout(request: Request) {
  if (request.method !== 'POST') return methodNotAllowed(['POST'])
  return json(
    { ok: true },
    { headers: { 'set-cookie': clearSessionCookie(), 'cache-control': 'no-store' } },
  )
}

// ---- /api/auth/me ----
async function me(request: Request) {
  const user = await readSession(request)
  if (user) return json({ user }, { headers: { 'cache-control': 'no-store' } })

  const pending = await readPendingSession(request)
  if (pending) {
    return json(
      { user: { ...pending, role: 'pending' }, availableRoles: googleRoles(pending.email) },
      { headers: { 'cache-control': 'no-store' } },
    )
  }

  return json({ user: null }, { status: 401, headers: { 'cache-control': 'no-store' } })
}

// ---- /api/auth/google ----
async function google(request: Request) {
  const url = new URL(request.url)
  if (url.searchParams.get('start') === '1') return startGoogle(request)

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code) return json({ error: 'Google authorization code is required.' }, { status: 400 })
  if (!state) return json({ error: 'OAuth state is required.' }, { status: 400 })
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
    return json({ error: 'Google OAuth is not configured.' }, { status: 503 })
  }

  try {
    await verifySignedState(state)

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: env.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    })
    if (!tokenResponse.ok) return json({ error: 'Google token exchange failed.' }, { status: 401 })

    const tokens = (await tokenResponse.json()) as { access_token?: string; id_token?: string }
    if (!tokens.access_token)
      return json({ error: 'Google did not return an access token.' }, { status: 401 })

    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { authorization: `Bearer ${tokens.access_token}` },
    })
    if (!profileResponse.ok)
      return json({ error: 'Google profile lookup failed.' }, { status: 401 })

    const profile = (await profileResponse.json()) as {
      sub?: string
      name?: string
      email?: string
      email_verified?: boolean
    }
    if (!profile.sub || !profile.email || profile.email_verified !== true) {
      return json({ error: 'A verified Google email is required.' }, { status: 403 })
    }

    const token = await createPendingSession({
      sub: `google:${profile.sub}`,
      name: profile.name || profile.email,
      email: profile.email,
    })
    return new Response(null, {
      status: 302,
      headers: {
        location: '/?onboarding=role',
        'set-cookie': pendingCookie(token),
        'cache-control': 'no-store',
      },
    })
  } catch (error) {
    console.error('google_oauth_failed', error)
    return json({ error: 'Google sign-in could not be completed.' }, { status: 503 })
  }
}

async function startGoogle(request: Request) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_REDIRECT_URI || !env.JWT_SECRET) {
    return json({ error: 'Google OAuth is not configured.' }, { status: 503 })
  }
  const state = await createSignedState(new URL(request.url).origin)
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    state,
  })
  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302)
}