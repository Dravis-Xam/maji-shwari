import { requireSession } from '../../_lib/auth'
import { ensureSchema, hasDatabase, sql } from '../../_lib/db'
import { json, methodNotAllowed } from '../../_lib/http'
import { isValidProjectStateTransition } from '../../projects'

export default async function handler(request: Request) {
  const auth = await requireSession(request)
  if (auth.response) return auth.response
  if (request.method !== 'POST') return methodNotAllowed(['POST'])
  const id = decodeURIComponent(new URL(request.url).pathname.split('/').at(-2) ?? '')
  let body: { state?: string }
  try { body = await request.json() } catch { return json({ error: 'Invalid JSON body' }, { status: 400 }) }
  const nextState = String(body.state ?? '')
  if (!hasDatabase()) return json({ id, state: nextState, demo: true })
  try {
    await ensureSchema()
    const query = sql()
    const rows = await query`SELECT status, owner_id, owner_role FROM projects WHERE id = ${id}` as unknown as Array<{ status: string; owner_id: string; owner_role: string }>
    const current = rows[0]
    if (!current) return json({ error: 'Project not found' }, { status: 404 })
    if (current.owner_id !== auth.session.sub && auth.session.role !== 'government') return json({ error: 'Only the project owner or a government official can change project state.' }, { status: 403 })
    if (!isValidProjectStateTransition(current.status, nextState)) return json({ error: `Invalid state transition from ${current.status} to ${nextState}.` }, { status: 422 })
    await query`UPDATE projects SET status = ${nextState}, current_progress = ${nextState === 'Completed' ? 100 : nextState === 'In progress' ? 50 : 0}, updated_at = NOW() WHERE id = ${id}`
    await query`INSERT INTO activity_events (event, detail) VALUES (${`Project ${id} state changed`}, ${`${current.status} -> ${nextState} by ${auth.session.name}`})`
    return json({ id, state: nextState })
  } catch { return json({ error: 'Project state could not be updated.' }, { status: 503 }) }
}
