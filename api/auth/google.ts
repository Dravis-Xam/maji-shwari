import { createSession, googleRole, sessionCookie } from '../_lib/auth'
import { json } from '../_lib/http'
import { jwtVerify, SignJWT } from 'jose'

const env = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
const stateSecret = () => new TextEncoder().encode(env.JWT_SECRET || 'local-development-secret-change-me')

export default async function handler(request: Request) {
  const url = new URL(request.url)
  if (url.searchParams.get('start') === '1') return startGoogle(request)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code) return json({ error: 'Google authorization code is required.' }, { status: 400 })
  if (!state) return json({ error: 'OAuth state is required.' }, { status: 400 })
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) return json({ error: 'Google OAuth is not configured.' }, { status: 503 })
  try {
    await jwtVerify(state, stateSecret())
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: env.GOOGLE_REDIRECT_URI, grant_type: 'authorization_code' }) })
    if (!tokenResponse.ok) return json({ error: 'Google token exchange failed.' }, { status: 401 })
    const tokens = await tokenResponse.json() as { access_token?: string; id_token?: string }
    if (!tokens.access_token) return json({ error: 'Google did not return an access token.' }, { status: 401 })
    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { authorization: `Bearer ${tokens.access_token}` } })
    if (!profileResponse.ok) return json({ error: 'Google profile lookup failed.' }, { status: 401 })
    const profile = await profileResponse.json() as { sub?: string; name?: string; email?: string; email_verified?: boolean }
    if (!profile.sub || !profile.email || profile.email_verified !== true) return json({ error: 'A verified Google email is required.' }, { status: 403 })
    const role = googleRole(profile.email)
    if (!role) return json({ error: 'Your Google account is not approved for a MajiShwari role.' }, { status: 403 })
    const token = await createSession({ sub: `google:${profile.sub}`, name: profile.name || profile.email, email: profile.email, role })
    return new Response(null, { status: 302, headers: { location: '/', 'set-cookie': sessionCookie(token), 'cache-control': 'no-store' } })
  } catch (error) {
    console.error('google_oauth_failed', error)
    return json({ error: 'Google sign-in could not be completed.' }, { status: 503 })
  }
}

async function startGoogle(request: Request) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_REDIRECT_URI || !env.JWT_SECRET) return json({ error: 'Google OAuth is not configured.' }, { status: 503 })
  const state = await new SignJWT({ origin: new URL(request.url).origin }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('10m').sign(stateSecret())
  const params = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: env.GOOGLE_REDIRECT_URI, response_type: 'code', scope: 'openid email profile', access_type: 'online', state })
  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302)
}
