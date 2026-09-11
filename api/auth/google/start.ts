import { SignJWT } from 'jose'
import { json } from '../../_lib/http'

const env = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
const secret = () => new TextEncoder().encode(env.JWT_SECRET || 'local-development-secret-change-me')

export default async function handler(request: Request) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_REDIRECT_URI || !env.JWT_SECRET) return json({ error: 'Google OAuth is not configured.' }, { status: 503 })
  const state = await new SignJWT({ origin: new URL(request.url).origin }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('10m').sign(secret())
  const params = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: env.GOOGLE_REDIRECT_URI, response_type: 'code', scope: 'openid email profile', access_type: 'online', state })
  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302)
}