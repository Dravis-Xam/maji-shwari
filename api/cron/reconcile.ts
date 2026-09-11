import { hasDatabase, ensureSchema, sql } from '../_lib/db'
import { json } from '../_lib/http'

const environment = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}

export default async function handler(request: Request) {
  if (request.method !== 'GET' && request.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 })
  const authorization = request.headers.get('authorization')
  if (environment.CRON_SECRET && authorization !== `Bearer ${environment.CRON_SECRET}`) return json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return json({ ok: true, mode: 'demo', message: 'Set DATABASE_URL to enable reconciliation.' })

  try {
    await ensureSchema()
    const query = sql()
    const staleFlags = await query`
      SELECT COUNT(*)::int AS count FROM audit_flags WHERE resolved_at IS NULL AND created_at < NOW() - INTERVAL '7 days'
    ` as unknown as Array<{ count: number }>
    const staleProjects = await query`
      UPDATE projects SET updated_at = NOW() WHERE updated_at < NOW() - INTERVAL '24 hours' RETURNING id
    ` as unknown as Array<{ id: string }>
    return json({ ok: true, staleFlags: Number(staleFlags[0].count), refreshedProjects: staleProjects.length })
  } catch (error) {
    console.error('cron_reconcile_failed', error)
    return json({ error: 'Reconciliation failed' }, { status: 503 })
  }
}
