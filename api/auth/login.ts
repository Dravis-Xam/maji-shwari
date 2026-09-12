import {
  clearPendingCookie,
  clearVerificationCookie,
  createSession,
  createVerificationSession,
  generateCode,
  hashCode,
  readPendingSession,
  readVerificationSession,
  sessionCookie,
  verificationCookie,
} from '../_lib/auth'
import { sendVerificationCode } from '../_lib/email'
import { json } from '../_lib/http'

const env =
  (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } })
    .process?.env ?? {}

const ROLES = ['community', 'government', 'donor'] as const
const MAX_ATTEMPTS = 5

type LoginBody = {
  name?: string
  role?: (typeof ROLES)[number]
  code?: string
  action?: 'role' | 'verify' | 'resend'
}

export async function POST(request: Request) {
  let body: LoginBody

  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (body.action === 'role') return startEmailVerification(request, body)
  if (body.action === 'verify') return verifyEmailCode(request, body)
  if (body.action === 'resend') return resendEmailCode(request)

  if (env.NODE_ENV === 'production') {
    return json({ error: 'Use Google sign-in.' }, { status: 410 })
  }

  const name = String(body.name ?? '')
    .trim()
    .slice(0, 80)
  if (name.length < 2) {
    return json({ error: 'Name is required.' }, { status: 422 })
  }

  const role = 'community' as const
  const token = await createSession({
    sub: `local:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name,
    email: 'local-preview@local.invalid',
    role,
  })

  return json(
    { user: { name, role } },
    {
      headers: {
        'set-cookie': sessionCookie(token),
        'cache-control': 'no-store',
      },
    },
  )
}

// After Google sign-in, the user picks any of the three roles with no allowlist
// restriction. Before that role becomes a real session, we email a 6-digit code
// and hold the choice in a short-lived signed cookie until it's confirmed.
async function startEmailVerification(request: Request, body: LoginBody) {
  const pending = await readPendingSession(request)
  if (!pending) {
    return json({ error: 'Google onboarding session expired. Sign in again.' }, { status: 401 })
  }

  if (!body.role || !ROLES.includes(body.role)) {
    return json({ error: 'Choose a workspace role to continue.' }, { status: 422 })
  }

  const code = generateCode()
  const codeHash = await hashCode(code)
  const token = await createVerificationSession({ ...pending, role: body.role }, codeHash)
  const { sent } = await sendVerificationCode(pending.email, pending.name, code)

  const headers = new Headers({ 'cache-control': 'no-store' })
  headers.append('set-cookie', verificationCookie(token))
  headers.append('set-cookie', clearPendingCookie())

  return json(
    {
      pendingVerification: true,
      email: pending.email,
      // Only surface the raw code when no email provider is configured, so local
      // and preview testing isn't blocked on setting up RESEND_API_KEY.
      ...(sent ? {} : { demoCode: code, demo: true }),
    },
    { headers },
  )
}

async function verifyEmailCode(request: Request, body: LoginBody) {
  const verification = await readVerificationSession(request)
  if (!verification) {
    return json({ error: 'Verification session expired. Choose your role again.' }, { status: 401 })
  }

  const code = String(body.code ?? '').trim()
  if (!code) return json({ error: 'Enter the code from your email.' }, { status: 422 })

  if (verification.attempts >= MAX_ATTEMPTS) {
    const headers = new Headers({ 'cache-control': 'no-store' })
    headers.append('set-cookie', clearVerificationCookie())
    return json(
      { error: 'Too many attempts. Choose your role again to get a new code.' },
      { status: 429, headers },
    )
  }

  const submittedHash = await hashCode(code)
  if (submittedHash !== verification.codeHash) {
    const attempts = verification.attempts + 1
    const token = await createVerificationSession(
      {
        sub: verification.sub,
        name: verification.name,
        email: verification.email,
        role: verification.role,
      },
      verification.codeHash,
      attempts,
    )
    return json(
      { error: 'That code is incorrect.', attemptsRemaining: MAX_ATTEMPTS - attempts },
      {
        status: 401,
        headers: { 'set-cookie': verificationCookie(token), 'cache-control': 'no-store' },
      },
    )
  }

  const token = await createSession({
    sub: verification.sub,
    name: verification.name,
    email: verification.email,
    role: verification.role,
  })

  const headers = new Headers({ 'cache-control': 'no-store' })
  headers.append('set-cookie', sessionCookie(token))
  headers.append('set-cookie', clearVerificationCookie())

  return json(
    {
      user: {
        sub: verification.sub,
        name: verification.name,
        email: verification.email,
        role: verification.role,
      },
    },
    { headers },
  )
}

async function resendEmailCode(request: Request) {
  const verification = await readVerificationSession(request)
  if (!verification) {
    return json({ error: 'Verification session expired. Choose your role again.' }, { status: 401 })
  }

  const code = generateCode()
  const codeHash = await hashCode(code)
  const token = await createVerificationSession(
    {
      sub: verification.sub,
      name: verification.name,
      email: verification.email,
      role: verification.role,
    },
    codeHash,
  )
  const { sent } = await sendVerificationCode(verification.email, verification.name, code)

  return json(
    { resent: true, ...(sent ? {} : { demoCode: code, demo: true }) },
    { headers: { 'set-cookie': verificationCookie(token), 'cache-control': 'no-store' } },
  )
}