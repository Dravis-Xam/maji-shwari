import { demoWorkspace, type WorkspacePayload } from './_lib/workspace'
import { hasDatabase, ensureSchema, sql } from './_lib/db'
import { cacheHeaders, json, methodNotAllowed } from './_lib/http'
import { requireSession } from './_lib/auth'

export default async function handler(request: Request) {
  const auth = await requireSession(request)
  if (auth.response) return auth.response
  if (request.method !== 'GET') return methodNotAllowed(['GET'])
  if (!hasDatabase()) return json(demoWorkspace, { headers: cacheHeaders(60) })

  try {
    await ensureSchema()
    const query = sql()
    const [releases, scores, activity] = await Promise.all([
      query`SELECT r.project_id, p.name AS project_name, r.amount_cents, r.status, r.milestone FROM fund_releases r JOIN projects p ON p.id = r.project_id ORDER BY r.created_at DESC LIMIT 30`,
      query`SELECT county, score, label FROM vulnerability_scores ORDER BY score DESC LIMIT 30`,
      query`SELECT event, detail, created_at FROM activity_events ORDER BY created_at DESC LIMIT 30`,
    ])
    const payload: WorkspacePayload = {
      source: 'neon',
      releases: (releases as unknown as Array<{ project_id: string; project_name: string; amount_cents: number; status: 'Approved' | 'Pending approval'; milestone: string }>).map((release) => ({ projectId: release.project_id, projectName: release.project_name, amount: `KES ${(Number(release.amount_cents) / 100000).toLocaleString('en-KE')}`, status: release.status, milestone: release.milestone })),
      vulnerability: (scores as unknown as Array<{ county: string; score: number; label: 'High risk' | 'Watch' | 'Stable' }>),
      rules: demoWorkspace.rules,
      activity: (activity as unknown as Array<{ event: string; detail: string; created_at: string }>).map((item) => ({ event: item.event, detail: item.detail, age: new Date(item.created_at).toLocaleString() })),
    }
    return json(payload, { headers: cacheHeaders(60) })
  } catch (error) {
    console.error('workspace_read_failed', error)
    return json(demoWorkspace, { headers: cacheHeaders(10) })
  }
}
