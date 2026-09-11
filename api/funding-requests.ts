import { canDonate, canRequestFunding, requireSession } from './_lib/auth'
import { ensureSchema, hasDatabase, sql } from './_lib/db'
import { json, methodNotAllowed } from './_lib/http'

export default async function handler(request: Request) {
  const auth = await requireSession(request)
  if (auth.response) return auth.response
  if (request.method === 'GET') return json({ requests: [] })
  if (request.method !== 'POST') return methodNotAllowed(['GET', 'POST'])
  let body: { projectId?: string; message?: string; amountCents?: number; kind?: 'request' | 'rod' }
  try { body = await request.json() } catch { return json({ error: 'Invalid JSON body' }, { status: 400 }) }
  const kind = body.kind ?? (auth.session.role === 'donor' ? 'rod' : 'request')
  if (kind === 'request' && !canRequestFunding(auth.session.role)) return json({ error: 'Only community and government users can request funding.' }, { status: 403 })
  if (kind === 'rod' && !canDonate(auth.session.role)) return json({ error: 'Only donors can submit a request to donate.' }, { status: 403 })
  const projectId = String(body.projectId ?? '').trim().toUpperCase()
  const message = String(body.message ?? '').trim()
  const amountCents = Number(body.amountCents ?? 0)
  if (!/^[A-Z0-9-]{3,32}$/.test(projectId) || message.length < 10 || !Number.isFinite(amountCents) || amountCents < 0) return json({ error: 'Project, message, and a valid amount are required.' }, { status: 422 })
  if (!hasDatabase()) return json({ accepted: true, kind, state: 'Open', demo: true }, { status: 201 })
  try {
    await ensureSchema()
    const query = sql()
    const projects = await query`SELECT id FROM projects WHERE id = ${projectId}` as unknown as Array<{ id: string }>
    if (!projects[0]) return json({ error: 'Project not found.' }, { status: 404 })
    await query`INSERT INTO funding_requests (project_id, requester_id, donor_id, kind, message, amount_cents) VALUES (${projectId}, ${auth.session.sub}, ${kind === 'rod' ? auth.session.sub : null}, ${kind}, ${message}, ${amountCents})`
    await query`INSERT INTO activity_events (event, detail) VALUES (${kind === 'rod' ? 'Request to donate received' : 'Funding request created'}, ${`${auth.session.name} posted on ${projectId}`})`
    return json({ accepted: true, kind, state: 'Open' }, { status: 201 })
  } catch { return json({ error: 'Funding request could not be saved.' }, { status: 503 }) }
}
