import { demoDashboard } from './_lib/demo'
import { hasDatabase, ensureSchema, sql } from './_lib/db'
import { cacheHeaders, json, methodNotAllowed } from './_lib/http'
import type { DashboardPayload } from './_lib/types'
import { requireSession } from './_lib/auth'

type ProjectRow = { id: string; name: string; county: string; status: string; required_confirmations: number; current_progress: number; amount_cents: number; confirmations: number }
type ReportRow = { raw_message: string; created_at: string; status: string; reporter_key: string }

export default async function handler(request: Request) {
  const auth = await requireSession(request)
  if (auth.response) return auth.response
  if (request.method !== 'GET') return methodNotAllowed(['GET'])
  if (!hasDatabase()) return json(demoDashboard, { headers: cacheHeaders(30) })

  try {
    await ensureSchema()
    const query = sql()
    const projects = await query`
      SELECT p.id, p.name, p.county, p.status, p.required_confirmations,
        p.current_progress, p.amount_cents,
        COUNT(r.id)::int AS confirmations
      FROM projects p
      LEFT JOIN reports r ON r.project_id = p.id AND r.status = 'DONE'
      GROUP BY p.id
      ORDER BY p.updated_at DESC
      LIMIT 50
    ` as unknown as ProjectRow[]
    const reports = await query`
      SELECT r.raw_message, r.created_at, r.status, r.reporter_key
      FROM reports r ORDER BY r.created_at DESC LIMIT 10
    ` as unknown as ReportRow[]
    const payload: DashboardPayload = {
      source: 'neon',
      metrics: {
        capitalMonitored: 'KES 0',
        activeProjects: projects.length,
        confirmations: projects.reduce((sum, project) => sum + Number(project.confirmations), 0),
        reportsNeedingReview: reports.filter((report) => report.status !== 'DONE').length,
      },
      projects: projects.map((project) => ({
        id: project.id,
        name: project.name,
        county: project.county,
        status: project.status === 'Verified' ? 'Verified' : 'In review',
        confirmations: `${project.confirmations} / ${project.required_confirmations}`,
        progress: Number(project.current_progress),
        amount: `KES ${(Number(project.amount_cents) / 100000).toLocaleString('en-KE')}`,
        color: project.status === 'Verified' ? 'green' : 'amber',
      })),
      reports: reports.map((report) => ({
        message: report.raw_message,
        source: `SMS · ${String(report.reporter_key).slice(0, 7)}•••`,
        time: new Date(report.created_at).toLocaleString(),
        tone: report.status === 'DONE' ? 'positive' : 'warning',
        label: report.status === 'DONE' ? 'Confirmed' : 'Audit flag',
      })),
    }
    return json(payload, { headers: cacheHeaders(30) })
  } catch (error) {
    console.error('dashboard_read_failed', error)
    return json({ ...demoDashboard, source: 'demo' }, { headers: cacheHeaders(10) })
  }
}
