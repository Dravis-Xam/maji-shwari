import { canCreateProject, requireSession } from './_lib/auth'
import { ensureSchema, hasDatabase, sql } from './_lib/db'
import { json, methodNotAllowed } from './_lib/http'

const states = ['Draft', 'Submitted', 'In progress', 'Completed'] as const
export default async function handler(request: Request) {
  const auth = await requireSession(request)
  if (auth.response) return auth.response
  if (request.method === 'GET') return json({ projects: [] })
  if (request.method !== 'POST') return methodNotAllowed(['GET', 'POST'])
  if (!canCreateProject(auth.session.role)) return json({ error: 'Only community and government users can create projects.' }, { status: 403 })
  let body: { id?: string; name?: string; county?: string; plan?: string; artifacts?: string; contact?: string; amountCents?: number }
  try { body = await request.json() } catch { return json({ error: 'Invalid JSON body' }, { status: 400 }) }
  const id = String(body.id ?? '').trim().toUpperCase()
  const name = String(body.name ?? '').trim()
  const county = String(body.county ?? '').trim()
  const plan = String(body.plan ?? '').trim()
  const artifacts = String(body.artifacts ?? '').trim()
  const contact = String(body.contact ?? '').trim()
  if (!/^[A-Z0-9-]{3,32}$/.test(id) || name.length < 3 || county.length < 2 || plan.length < 20 || artifacts.length < 3 || contact.length < 5) return json({ error: 'Project code, name, county, plan, artifacts, and contact details are required.' }, { status: 422 })
  if (!hasDatabase()) return json({ project: { id, name, county, status: 'Draft', state: 'Draft' }, demo: true }, { status: 201 })
  try {
    await ensureSchema()
    const query = sql()
    await query`INSERT INTO projects (id, name, county, owner_id, owner_role, plan, artifacts, contact, status, current_progress, amount_cents) VALUES (${id}, ${name}, ${county}, ${auth.session.sub}, ${auth.session.role}, ${plan}, ${artifacts}, ${contact}, 'In review', 0, ${Number(body.amountCents ?? 0)})`
    await query`INSERT INTO activity_events (event, detail) VALUES (${`Project ${id} created`}, ${`${auth.session.name} submitted a project plan`})`
    return json({ project: { id, name, county, status: 'Draft', state: 'Draft' } }, { status: 201 })
  } catch (error) {
    console.error('project_create_failed', error)
    return json({ error: 'Project could not be created. The code may already exist.' }, { status: 409 })
  }
}

export function isValidProjectStateTransition(from: string, to: string) {
  const allowed: Record<string, string[]> = { Draft: ['Submitted'], Submitted: ['In progress', 'Draft'], 'In progress': ['Completed'], Completed: [] }
  return states.includes(to as typeof states[number]) && (allowed[from] ?? []).includes(to)
}
