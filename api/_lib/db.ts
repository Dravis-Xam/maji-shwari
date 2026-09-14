import { neon } from '@neondatabase/serverless'

let sqlClient: ReturnType<typeof neon> | undefined
let schemaPromise: Promise<void> | undefined
const environment =
  (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } })
    .process?.env ?? {}

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
  await query`ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_id TEXT`
  await query`ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_role TEXT`
  await query`ALTER TABLE projects ADD COLUMN IF NOT EXISTS plan TEXT`
  await query`ALTER TABLE projects ADD COLUMN IF NOT EXISTS artifacts TEXT`
  await query`ALTER TABLE projects ADD COLUMN IF NOT EXISTS contact TEXT`
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
  await query`
    CREATE TABLE IF NOT EXISTS fund_releases (
      id BIGSERIAL PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      milestone TEXT NOT NULL,
      amount_cents BIGINT NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Pending approval',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await query`
    CREATE TABLE IF NOT EXISTS vulnerability_scores (
      county TEXT PRIMARY KEY,
      score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
      label TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await query`
    CREATE TABLE IF NOT EXISTS activity_events (
      id BIGSERIAL PRIMARY KEY,
      event TEXT NOT NULL,
      detail TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await query`
    CREATE TABLE IF NOT EXISTS funding_requests (
      id BIGSERIAL PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      requester_id TEXT NOT NULL,
      donor_id TEXT,
      kind TEXT NOT NULL CHECK (kind IN ('request', 'rod')),
      message TEXT NOT NULL,
      amount_cents BIGINT NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Open',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await query`
    CREATE TABLE IF NOT EXISTS notifications (
      id BIGSERIAL PRIMARY KEY,
      user_sub TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await query`CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON notifications(user_sub, created_at DESC)`
}