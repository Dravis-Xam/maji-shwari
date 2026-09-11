import { hasDatabase, sql } from './_lib/db'
import { json } from './_lib/http'

export default async function handler() {
  if (!hasDatabase()) return json({ ok: true, database: 'demo', service: 'maji-shwari-api' })
  try {
    await sql()`SELECT 1`
    return json({ ok: true, database: 'neon', service: 'maji-shwari-api' })
  } catch {
    return json({ ok: false, database: 'unavailable', service: 'maji-shwari-api' }, { status: 503 })
  }
}
