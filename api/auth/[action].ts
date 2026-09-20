import { getRequestHeader, requestUrl, requireSession } from '../_lib/auth'
import { ensureSchema, hasDatabase, sql } from '../_lib/db'
import { json } from '../_lib/http'

const env =
  (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } })
    .process?.env ?? {}

function actionFromUrl(request: Request) {
  const segments = requestUrl(request).pathname.split('/')
  return segments[segments.length - 1]
}

// Single entry point for /api/sms/webhook (Twilio's inbound hook) and
// /api/sms/link-code (called from the dashboard). Native dynamic route,
// not a vercel.json rewrite — see api/auth/[action].ts for why.
export async function POST(request: Request) {
  const action = actionFromUrl(request)
  if (action === 'webhook') return smsWebhook(request)
  if (action === 'link-code') return generateLinkCode(request)
  return json({ error: 'Unknown SMS action.' }, { status: 404 })
}

// ---- POST /api/sms/link-code (authenticated, from the dashboard) ----
async function generateLinkCode(request: Request) {
  const auth = await requireSession(request)
  if (auth.response) return auth.response

  if (!hasDatabase()) {
    return json(
      { error: 'SMS linking needs a database. Add DATABASE_URL to enable it.' },
      { status: 503 },
    )
  }

  try {
    await ensureSchema()
    const query = sql()
    const code = String(Math.floor(100000 + Math.random() * 900000))
    await query`
      INSERT INTO link_codes (code, user_sub, role, name, expires_at)
      VALUES (${code}, ${auth.session.sub}, ${auth.session.role}, ${auth.session.name}, NOW() + INTERVAL '10 minutes')
    `
    return json({
      code,
      expiresInMinutes: 10,
      instructions: `Text "LINK ${code}" to the MajiShwari SMS number to connect this phone to your account.`,
    })
  } catch (error) {
    console.error('sms_link_code_failed', error)
    return json({ error: 'Could not generate a linking code. Try again.' }, { status: 503 })
  }
}

// ---- POST /api/sms/webhook (Twilio inbound SMS) ----
async function smsWebhook(request: Request) {
  const contentType = getRequestHeader(request, 'content-type') ?? ''
  if (!contentType.includes('application/x-www-form-urlencoded')) {
    return twiml('Unsupported request.')
  }

  const form = await request.formData()
  const body = String(form.get('Body') ?? '').trim()
  const from = String(form.get('From') ?? '').trim()

  if (!from) return twiml('Could not identify your phone number.')

  const signatureOk = await verifyTwilioSignature(request, form)
  if (!signatureOk) {
    console.error('sms_webhook_bad_signature')
    return json({ error: 'Invalid signature.' }, { status: 403 })
  }

  if (!hasDatabase()) {
    return twiml(
      'SMS features need a database connection. Ask your administrator to set DATABASE_URL.',
    )
  }

  try {
    await ensureSchema()
    const reply = await handleCommand(from, body)
    return twiml(reply)
  } catch (error) {
    console.error('sms_webhook_failed', error)
    return twiml('Something went wrong on our end. Please try again shortly.')
  }
}

const HELP_TEXT =
  'MajiShwari SMS commands:\n' +
  'HELP - this message\n' +
  'LINK <code> - connect your phone to your web account\n' +
  'STATUS <code> - check a project, e.g. STATUS BHR-042\n' +
  'FUNDS <code> - check fund release status\n' +
  'NEW <name>; <county> - start a project (community/government only)\n' +
  '<code> DONE/DELAYED/PROBLEM - report progress, e.g. BHR-042 DONE'

async function handleCommand(from: string, body: string): Promise<string> {
  const trimmed = body.trim()
  const upper = trimmed.toUpperCase()
  const phoneKey = await hashPhone(from)

  if (!trimmed || upper === 'HELP') return HELP_TEXT

  if (upper.startsWith('LINK ')) {
    return handleLink(phoneKey, trimmed.slice(5).trim())
  }

  if (upper.startsWith('STATUS ')) {
    return handleStatus(trimmed.slice(7).trim())
  }

  if (upper.startsWith('FUNDS ')) {
    return handleFunds(trimmed.slice(6).trim())
  }

  if (upper.startsWith('NEW ')) {
    return handleNewProject(phoneKey, from, trimmed.slice(4).trim())
  }

  // Fall through: treat "<CODE> STATUS" as a verification report, the same
  // grammar the web dashboard's report intake accepts (e.g. "BHR-042 DONE").
  const reportMatch = trimmed.match(/^([A-Za-z0-9-]{3,32})\s+(DONE|DELAYED|INCOMPLETE|PROBLEM)$/i)
  if (reportMatch) {
    return handleReport(phoneKey, reportMatch[1].toUpperCase(), reportMatch[2].toUpperCase())
  }

  return `Sorry, I didn't understand that. ${HELP_TEXT}`
}

async function handleLink(phoneKey: string, code: string): Promise<string> {
  if (!/^\d{6}$/.test(code)) return 'That code should be 6 digits, e.g. LINK 482913.'

  const query = sql()
  const rows = (await query`
    SELECT user_sub, role, name FROM link_codes
    WHERE code = ${code} AND expires_at > NOW()
  `) as unknown as { user_sub: string; role: string; name: string }[]
  const match = rows[0]
  if (!match) return 'That code is invalid or expired. Generate a new one from your dashboard.'

  await query`
    INSERT INTO phone_links (phone_key, user_sub, role, name)
    VALUES (${phoneKey}, ${match.user_sub}, ${match.role}, ${match.name})
    ON CONFLICT (phone_key) DO UPDATE SET user_sub = EXCLUDED.user_sub, role = EXCLUDED.role, name = EXCLUDED.name
  `
  await query`DELETE FROM link_codes WHERE code = ${code}`

  return `Linked! This phone is now connected to your ${match.role} account (${match.name}). Text HELP for commands.`
}

async function findLinkedPhone(
  phoneKey: string,
): Promise<{ user_sub: string; role: string; name: string } | null> {
  const query = sql()
  const rows = (await query`
    SELECT user_sub, role, name FROM phone_links WHERE phone_key = ${phoneKey}
  `) as unknown as { user_sub: string; role: string; name: string }[]
  return rows[0] ?? null
}

async function handleStatus(code: string): Promise<string> {
  const id = code.toUpperCase()
  if (!id) return 'Send STATUS followed by a project code, e.g. STATUS BHR-042.'

  const query = sql()
  const rows = (await query`
    SELECT name, status, current_progress, required_confirmations,
      (SELECT COUNT(*) FROM reports WHERE project_id = ${id} AND status = 'DONE') AS confirmations
    FROM projects WHERE id = ${id}
  `) as unknown as {
    name: string
    status: string
    current_progress: number
    required_confirmations: number
    confirmations: number
  }[]
  const project = rows[0]
  if (!project) return `No project found with code ${id}.`

  return (
    `${id} — ${project.name}\n` +
    `Status: ${project.status}\n` +
    `Progress: ${project.current_progress}%\n` +
    `Confirmations: ${project.confirmations} / ${project.required_confirmations}`
  )
}

async function handleFunds(code: string): Promise<string> {
  const id = code.toUpperCase()
  if (!id) return 'Send FUNDS followed by a project code, e.g. FUNDS BHR-042.'

  const query = sql()
  const rows = (await query`
    SELECT milestone, amount_cents, status FROM fund_releases
    WHERE project_id = ${id} ORDER BY created_at DESC LIMIT 1
  `) as unknown as { milestone: string; amount_cents: number; status: string }[]
  const release = rows[0]
  if (!release) return `No fund release records found for ${id} yet.`

  const amount = (Number(release.amount_cents) / 100).toLocaleString()
  return `${id} latest release — ${release.milestone}: KES ${amount} (${release.status}).`
}

async function handleNewProject(phoneKey: string, from: string, rest: string): Promise<string> {
  const linked = await findLinkedPhone(phoneKey)
  if (!linked) {
    return "This phone isn't linked yet. Get a code from your dashboard and text LINK <code> first."
  }
  if (linked.role !== 'community' && linked.role !== 'government') {
    return 'Only community and government accounts can start a project.'
  }

  const [namePart, countyPart] = rest.split(';').map((part) => part?.trim())
  const name = namePart ?? ''
  const county = countyPart ?? ''
  if (name.length < 3 || county.length < 2) {
    return 'Format: NEW <project name>; <county>. Example: NEW Community Solar Borehole; Makueni'
  }

  const letters =
    name
      .replace(/[^a-zA-Z\s]/g, '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 3)
      .padEnd(3, 'X') || 'PRJ'

  const query = sql()
  let id = ''
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${letters}-${Math.floor(100 + Math.random() * 900)}`
    const existing = (await query`SELECT 1 FROM projects WHERE id = ${candidate}`) as unknown[]
    if (existing.length === 0) {
      id = candidate
      break
    }
  }
  if (!id) return 'Could not generate a project code right now. Please try again.'

  try {
    await query`
      INSERT INTO projects (id, name, county, owner_id, owner_role, plan, artifacts, contact, status, lifecycle_state, current_progress, amount_cents)
      VALUES (
        ${id}, ${name}, ${county}, ${linked.user_sub}, ${linked.role},
        'Created via SMS — add a full plan on the web dashboard.',
        'Pending', ${from}, 'In review', 'Draft', 0, 0
      )
    `
    await query`
      INSERT INTO activity_events (event, detail)
      VALUES (${`Project ${id} created`}, ${`${linked.name} started this project via SMS`})
    `
  } catch (error) {
    console.error('sms_new_project_failed', error)
    return 'Could not create the project. Please try again or use the dashboard.'
  }

  return `Created ${id} — ${name} (${county}), status Draft. Finish the plan, contact, and artifacts on your dashboard.`
}

async function handleReport(phoneKey: string, projectId: string, status: string): Promise<string> {
  const query = sql()

  const projectRows = (await query`
    SELECT status FROM projects WHERE id = ${projectId}
  `) as unknown as { status: string }[]
  if (!projectRows[0]) return `No project found with code ${projectId}.`

  try {
    await query`
      INSERT INTO reports (project_id, reporter_key, status, raw_message)
      VALUES (${projectId}, ${phoneKey}, ${status}, ${`${projectId} ${status}`})
    `
  } catch {
    return `Thanks, but you've already reported ${projectId} ${status}.`
  }

  if (status === 'DELAYED' || status === 'INCOMPLETE' || status === 'PROBLEM') {
    await query`
      INSERT INTO audit_flags (project_id, reason)
      VALUES (${projectId}, ${`Community report: ${status}`})
    `
    await query`
      INSERT INTO activity_events (event, detail)
      VALUES (${`${projectId} marked for audit review`}, ${'SMS community report'})
    `
    return `Report recorded. An audit flag was created for ${projectId}.`
  }

  const countRows = (await query`
    SELECT COUNT(*)::int AS confirmations FROM reports
    WHERE project_id = ${projectId} AND status = 'DONE'
  `) as unknown as { confirmations: number }[]
  const confirmations = countRows[0]?.confirmations ?? 0

  const thresholdRows = (await query`
    SELECT required_confirmations FROM projects WHERE id = ${projectId}
  `) as unknown as { required_confirmations: number }[]
  const threshold = thresholdRows[0]?.required_confirmations ?? 12

  if (confirmations >= threshold) {
    await query`UPDATE projects SET status = 'Verified' WHERE id = ${projectId}`
    await query`
      INSERT INTO activity_events (event, detail)
      VALUES (${`${projectId} reached verification threshold`}, ${'SMS community report'})
    `
    return `Thanks! ${projectId} just reached its verification threshold and is now Verified.`
  }

  return `Thanks! Recorded. ${projectId} now has ${confirmations} / ${threshold} confirmations.`
}

// ---- Helpers ----

async function hashPhone(phone: string): Promise<string> {
  const normalized = phone.replace(/[^\d+]/g, '')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized))
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 24)
}

function twiml(message: string) {
  const escaped = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const body = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`
  return new Response(body, { headers: { 'content-type': 'text/xml' } })
}

// Twilio signs each webhook request: base64(HMAC-SHA1(authToken, url + sorted
// "key"+"value" pairs from the POST body)). If TWILIO_AUTH_TOKEN isn't set,
// this skips verification (matches this project's pattern of degrading
// gracefully when optional integrations aren't configured) but logs it.
async function verifyTwilioSignature(request: Request, form: FormData): Promise<boolean> {
  const authToken = env.TWILIO_AUTH_TOKEN
  if (!authToken) {
    console.warn('sms_webhook_unverified: TWILIO_AUTH_TOKEN is not set')
    return true
  }

  const signature = getRequestHeader(request, 'x-twilio-signature')
  if (!signature) return false

  const url = requestUrl(request).toString()
  const sortedKeys = Array.from(new Set(form.keys())).sort()
  let data = url
  for (const key of sortedKeys) {
    data += key + String(form.get(key) ?? '')
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(authToken),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  const signatureBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  const expected = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)))

  return expected === signature
}