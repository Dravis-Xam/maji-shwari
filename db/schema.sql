CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  county TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'In review',
  required_confirmations INTEGER NOT NULL DEFAULT 12,
  current_progress INTEGER NOT NULL DEFAULT 0,
  amount_cents BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reports (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  reporter_key TEXT NOT NULL,
  status TEXT NOT NULL,
  raw_message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, reporter_key, status)
);

CREATE TABLE IF NOT EXISTS audit_flags (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  report_id BIGINT REFERENCES reports(id),
  reason TEXT NOT NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reports_project_created_idx ON reports(project_id, created_at DESC);
