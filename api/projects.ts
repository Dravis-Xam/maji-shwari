import { canCreateProject, requireSession } from './_lib/auth'
import type { Session } from './_lib/auth'
import { ensureSchema, hasDatabase, sql } from './_lib/db'
import { json, methodNotAllowed } from './_lib/http'

const states = ['Draft', 'Submitted', 'In progress', 'Completed'] as const
type ProjectState = (typeof states)[number]

export default async function handler(request: Request) {
  const auth = await requireSession(request)
  if (auth.response) return auth.response

  if (request.method === 'GET') return json({ projects: [] })
  if (request.method === 'POST') return createProject(request, auth.session)
  if (request.method === 'PATCH') return transitionProject(request, auth.session)
  return methodNotAllowed(['GET', 'POST', 'PATCH'])
}

// ---- POST /api/projects (create) ----
async function createProject(request: Request, session: Session) {
  if (!canCreateProject(session.role))
    return json(
      { error: 'Only community and government users can create projects.' },
      { status: 403 },
    )

  let body: {
    id?: string
    name?: string
    county?: string
    plan?: string
    artifacts?: string
    contact?: string
    amountCents?: number
  }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const id = String(body.id ?? '')
    .trim()
    .toUpperCase()
  const name = String(body.name ?? '').trim()
  const county = String(body.county ?? '').trim()
  const plan = String(body.plan ?? '').trim()
  const artifacts = String(body.artifacts ?? '').trim()
  const contact = String(body.contact ?? '').trim()

  if (
    !/^[A-Z0-9-]{3,32}$/.test(id) ||
    name.length < 3 ||
    county.length < 2 ||
    plan.length < 20 ||
    artifacts.length < 3 ||
    contact.length < 5
  ) {
    return json(
      { error: 'Project code, name, county, plan, artifacts, and contact details are required.' },
      { status: 422 },
    )
  }

  if (!hasDatabase())
    return json(
      { project: { id, name, county, status: 'In review', lifecycleState: 'Draft' }, demo: true },
      { status: 201 },
    )

  try {
    await ensureSchema()
    const query = sql()
    // status: community-verification state (drives dashboard cards, see /api/reports).
    // lifecycle_state: owner/government-driven workflow (drives transitionProject below).
    // The two are independent — a project can be "In review" (verification) while
    // also sitting in the "Submitted" lifecycle stage.
    await query`
      INSERT INTO projects (id, name, county, owner_id, owner_role, plan, artifacts, contact, status, lifecycle_state, current_progress, amount_cents)
      VALUES (${id}, ${name}, ${county}, ${session.sub}, ${session.role}, ${plan}, ${artifacts}, ${contact}, 'In review', 'Draft', 0, ${Number(body.amountCents ?? 0)})
    `
    await query`
      INSERT INTO activity_events (event, detail)
      VALUES (${`Project ${id} created`}, ${`${session.name} submitted a project plan`})
    `
    return json(
      { project: { id, name, county, status: 'In review', lifecycleState: 'Draft' } },
      { status: 201 },
    )
  } catch (error) {
    console.error('project_create_failed', error)
    return json(
      { error: 'Project could not be created. The code may already exist.' },
      { status: 409 },
    )
  }
}

// ---- PATCH /api/projects  { id, lifecycleState } ----
// Moves a project through Draft -> Submitted -> In progress -> Completed.
// Per the role permissions table: community/government users may transition
// a project they own; government users may additionally transition ANY
// project (oversight); donors can never trigger a transition.
async function transitionProject(request: Request, session: Session) {
  if (session.role === 'donor')
    return json({ error: "Donors cannot change a project's lifecycle state." }, { status: 403 })

  let body: { id?: string; lifecycleState?: string }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const id = String(body.id ?? '')
    .trim()
    .toUpperCase()
  const to = String(body.lifecycleState ?? '').trim() as ProjectState
  if (!id) return json({ error: 'Project id is required.' }, { status: 400 })
  if (!states.includes(to)) return json({ error: 'Unknown lifecycle state.' }, { status: 422 })

  if (!hasDatabase()) return json({ project: { id, lifecycleState: to }, demo: true })

  try {
    await ensureSchema()
    const query = sql()
    const rows = (await query`
      SELECT lifecycle_state, owner_id FROM projects WHERE id = ${id}
    `) as unknown as { lifecycle_state: string; owner_id: string | null }[]
    const project = rows[0]
    if (!project) return json({ error: 'Project not found.' }, { status: 404 })

    // Government has oversight of every project; community is restricted to its own.
    if (session.role === 'community' && project.owner_id !== session.sub) {
      return json({ error: 'You can only update the status of projects you own.' }, { status: 403 })
    }

    if (!isValidProjectStateTransition(project.lifecycle_state, to)) {
      return json(
        { error: `Cannot move a project from ${project.lifecycle_state} to ${to}.` },
        { status: 409 },
      )
    }

    await query`UPDATE projects SET lifecycle_state = ${to}, updated_at = NOW() WHERE id = ${id}`
    await query`
      INSERT INTO activity_events (event, detail)
      VALUES (${`Project ${id} moved to ${to}`}, ${`${session.name} updated the project lifecycle state`})
    `
    return json({ project: { id, lifecycleState: to } })
  } catch (error) {
    console.error('project_transition_failed', error)
    return json({ error: 'Project lifecycle state could not be updated.' }, { status: 503 })
  }
}

export function isValidProjectStateTransition(from: string, to: string) {
  const allowed: Record<string, string[]> = {
    Draft: ['Submitted'],
    Submitted: ['In progress', 'Draft'],
    'In progress': ['Completed'],
    Completed: [],
  }
  return states.includes(to as ProjectState) && (allowed[from] ?? []).includes(to)
}