import { hasDatabase, ensureSchema, sql } from './_lib/db'
import { cacheHeaders, json } from './_lib/http'
import { demoWorkspace, type WorkspacePayload } from './_lib/workspace'
import { requireSession } from './_lib/auth'

type ReleaseRow = {
  project_id: string
  project_name: string
  amount_cents: number
  status: string
  milestone: string
}
type VulnerabilityRow = { county: string; score: number; label: string }
type ActivityRow = { event: string; detail: string; created_at: string }
type FundingRequestRow = {
  id: number
  project_id: string
  project_name: string
  kind: string
  message: string
  amount_cents: number
  status: string
}

// Verification rules are fixed product copy, not per-deployment data, so they
// aren't stored in a table — same content in both Neon and demo mode.
const RULES = [
  {
    title: 'Unique reporters',
    detail: 'Count one confirmation per reporter, project, and status.',
  },
  {
    title: 'Threshold',
    detail: 'A project reaches verified after its configured confirmation count.',
  },
  {
    title: 'Audit flags',
    detail: 'DELAYED, INCOMPLETE, and PROBLEM reports create an audit flag.',
  },
  {
    title: 'Evidence format',
    detail: 'Messages must use PROJECT-CODE STATUS, such as BHR-042 DONE.',
  },
]

function formatAge(timestamp: string) {
  const diffMs = Date.now() - new Date(timestamp).getTime()
  const hours = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)))
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export async function GET(request: Request) {
  const auth = await requireSession(request)
  if (auth.response) return auth.response
  if (!hasDatabase()) return json(demoWorkspace, { headers: cacheHeaders(30) })

  try {
    await ensureSchema()
    const query = sql()

    const releases = (await query`
      SELECT fr.project_id, p.name AS project_name, fr.amount_cents, fr.status, fr.milestone
      FROM fund_releases fr
      JOIN projects p ON p.id = fr.project_id
      ORDER BY fr.created_at DESC
      LIMIT 20
    `) as unknown as ReleaseRow[]

    const vulnerability = (await query`
      SELECT county, score, label FROM vulnerability_scores ORDER BY score DESC
    `) as unknown as VulnerabilityRow[]

    const activity = (await query`
      SELECT event, detail, created_at FROM activity_events ORDER BY created_at DESC LIMIT 20
    `) as unknown as ActivityRow[]

    const fundingRequests = (await query`
      SELECT fr.id, fr.project_id, p.name AS project_name, fr.kind, fr.message, fr.amount_cents, fr.status
      FROM funding_requests fr
      JOIN projects p ON p.id = fr.project_id
      ORDER BY fr.created_at DESC
      LIMIT 20
    `) as unknown as FundingRequestRow[]

    const payload: WorkspacePayload = {
      source: 'neon',
      releases: releases.map((release) => ({
        projectId: release.project_id,
        projectName: release.project_name,
        amount: `KES ${(Number(release.amount_cents) / 100000).toLocaleString('en-KE')}`,
        status: release.status === 'Approved' ? 'Approved' : 'Pending approval',
        milestone: release.milestone,
      })),
      vulnerability: vulnerability.map((row) => ({
        county: row.county,
        score: Number(row.score),
        label: row.label as 'High risk' | 'Watch' | 'Stable',
      })),
      rules: RULES,
      activity: activity.map((row) => ({
        event: row.event,
        detail: row.detail,
        age: formatAge(row.created_at),
      })),
      fundingRequests: fundingRequests.map((row) => ({
        id: String(row.id),
        projectId: row.project_id,
        projectName: row.project_name,
        kind: row.kind === 'rod' ? 'rod' : 'request',
        message: row.message,
        amountCents: Number(row.amount_cents),
        status:
          row.status === 'Funded'
            ? 'Funded'
            : row.status === 'Pending approval'
              ? 'Pending approval'
              : 'Open',
      })),
    }

    return json(payload, { headers: cacheHeaders(30) })
  } catch (error) {
    console.error('workspace_read_failed', error)
    return json({ ...demoWorkspace, source: 'demo' }, { headers: cacheHeaders(10) })
  }
}