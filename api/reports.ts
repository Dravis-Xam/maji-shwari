import { demoDashboard } from './_lib/demo'
import { hasDatabase, ensureSchema, sql } from './_lib/db'
import { json, methodNotAllowed } from './_lib/http'
import type { ReportStatus } from './_lib/types'
import { requireSession } from './_lib/auth'

const reportPattern = /^([A-Z0-9-]{3,32})\s+(DONE|DELAYED|INCOMPLETE|PROBLEM)$/i
type ProjectRow = { id: string; required_confirmations: number }
type InsertedRow = { id: number }
type CountRow = { count: number }

function normalizePhone(value: unknown) {
  return String(value ?? '').replace(/[^0-9+]/g, '').slice(0, 32)
}

function hashReporter(phone: string) {
  let hash = 2166136261
  for (const character of phone) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  return `r_${(hash >>> 0).toString(16)}`
}

export default async function handler(request: Request) {
  const auth = await requireSession(request)
  if (auth.response) return auth.response
  if (request.method === 'GET') return json({ reports: demoDashboard.reports })
  if (request.method !== 'POST') return methodNotAllowed(['GET', 'POST'])

  let body: { message?: string; phone?: string }
  try { body = await request.json() } catch { return json({ error: 'Request body must be valid JSON' }, { status: 400 }) }
  const message = String(body.message ?? '').trim().toUpperCase()
  const phone = normalizePhone(body.phone)
  const match = message.match(reportPattern)
  if (!match || phone.length < 8) {
    return json({ error: 'Use a project code and status, for example BHR-042 DONE, with a valid phone number.' }, { status: 422 })
  }
  const [, projectId, status] = match as [string, string, ReportStatus]
  if (!hasDatabase()) return json({ accepted: true, state: status === 'DONE' ? 'pending_verification' : 'audit_flagged', demo: true })

  try {
    await ensureSchema()
    const query = sql()
    const reporterKey = hashReporter(phone)
    const projects = await query`SELECT id, required_confirmations FROM projects WHERE id = ${projectId}` as unknown as ProjectRow[]
    if (!projects[0]) return json({ error: 'Project code was not found' }, { status: 404 })
    const inserted = await query`
      INSERT INTO reports (project_id, reporter_key, status, raw_message)
      VALUES (${projectId}, ${reporterKey}, ${status}, ${message})
      ON CONFLICT (project_id, reporter_key, status) DO NOTHING
      RETURNING id
    ` as unknown as InsertedRow[]
    if (!inserted[0]) return json({ accepted: true, duplicate: true, state: 'already_recorded' })

    if (status !== 'DONE') {
      await query`INSERT INTO audit_flags (project_id, report_id, reason) VALUES (${projectId}, ${inserted[0].id}, ${status})`
    }
    const confirmationRows = await query`
      SELECT COUNT(DISTINCT reporter_key)::int AS count FROM reports WHERE project_id = ${projectId} AND status = 'DONE'
    ` as unknown as CountRow[]
    const confirmations = Number(confirmationRows[0].count)
    const threshold = Number(projects[0].required_confirmations)
    const verified = confirmations >= threshold
    await query`UPDATE projects SET status = ${verified ? 'Verified' : 'In review'}, updated_at = NOW() WHERE id = ${projectId}`
    return json({ accepted: true, duplicate: false, state: status === 'DONE' && verified ? 'verified' : status === 'DONE' ? 'pending_verification' : 'audit_flagged', confirmations, threshold })
  } catch (error) {
    console.error('report_write_failed', error)
    return json({ error: 'Report could not be recorded. Try again shortly.' }, { status: 503 })
  }
}
