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
ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_id TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_role TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS plan TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS artifacts TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS contact TEXT;
-- Owner/government-driven lifecycle stage (Draft -> Submitted -> In progress
-- -> Completed), independent of `status` above, which tracks community
-- verification (In review / Verified) and is unaffected by lifecycle moves.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS lifecycle_state TEXT NOT NULL DEFAULT 'Draft';

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

CREATE TABLE IF NOT EXISTS fund_releases (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  milestone TEXT NOT NULL,
  amount_cents BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Pending approval',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vulnerability_scores (
  county TEXT PRIMARY KEY,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  label TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_events (
  id BIGSERIAL PRIMARY KEY,
  event TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
);

-- A Google account's chosen role, saved once on first login (self-service
-- role selection, see POST /api/auth/login) and looked up on every
-- subsequent login so the picker only shows once per account.
CREATE TABLE IF NOT EXISTS users (
  sub TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('community', 'government', 'donor')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One-time codes generated from the dashboard (POST /api/sms/link-code)
-- and redeemed by texting "LINK <code>" to the Twilio number, which
-- creates the matching row in phone_links below.
CREATE TABLE IF NOT EXISTS link_codes (
  code TEXT PRIMARY KEY,
  user_sub TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('community', 'government', 'donor')),
  name TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A verified phone number's link to an existing web account. phone_key is
-- a salted hash of the E.164 number, never the raw number, matching this
-- project's existing phone-hashing principle for reports.reporter_key.
CREATE TABLE IF NOT EXISTS phone_links (
  phone_key TEXT PRIMARY KEY,
  user_sub TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('community', 'government', 'donor')),
  name TEXT NOT NULL,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);