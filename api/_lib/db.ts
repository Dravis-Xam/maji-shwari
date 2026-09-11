import { neon } from '@neondatabase/serverless'

let sqlClient: ReturnType<typeof neon> | undefined
let schemaPromise: Promise<void> | undefined
const environment = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}

export function hasDatabase() {
  return Boolean(environment.DATABASE_URL)
}

export function sql() {
  if (!environment.DATABASE_URL) throw new Error('DATABASE_URL is not configured')
  sqlClient ??= neon(environment.DATABASE_URL, { fetchOptions: { cache: 'no-store' } })
  return sqlClient
}

export async function ensureSchema() {
  schemaPromise ??= createSchema()
  return schemaPromise
}

async function createSchema() {
  const query = sql()
  await query`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      county TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'In review',
      required_confirmations INTEGER NOT NULL DEFAULT 12,
      current_progress INTEGER NOT NULL DEFAULT 0,
      amount_cents BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await query`
    CREATE TABLE IF NOT EXISTS reports (
      id BIGSERIAL PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      reporter_key TEXT NOT NULL,
      status TEXT NOT NULL,
      raw_message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (project_id, reporter_key, status)
    )
  `
  await query`
    CREATE TABLE IF NOT EXISTS audit_flags (
      id BIGSERIAL PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      report_id BIGINT REFERENCES reports(id),
      reason TEXT NOT NULL,
      resolved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await query`CREATE INDEX IF NOT EXISTS reports_project_created_idx ON reports(project_id, created_at DESC)`
}
