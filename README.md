# MajiShwari Climate Finance Verification Platform

MajiShwari is a prototype dashboard for making local climate-finance projects easier to verify, monitor, and audit. It is based on the requirements in `CLIMATE FINANCE VERIFICATION PLATFORM.pdf`.

The current implementation is a responsive React dashboard for county administrators and donors, backed by Vercel serverless API routes. It can run in demo mode without cloud credentials, or use Neon PostgreSQL when `DATABASE_URL` is configured.

## What It Solves

Climate projects can be delayed or misused when local communities cannot easily report what they see and those reports are disconnected from county and donor oversight. MajiShwari creates a shared operating view around three signals:

1. Community reports submitted through a simple SMS-style format.
2. Independent confirmations used to determine whether a project meets its verification threshold.
3. Fund and risk information shown alongside project progress so action can happen before a problem becomes expensive.

## Current Prototype

The application lives in [`app/`](app/).

### Dashboard areas

- **Overview:** capital monitored, active projects, community confirmations, and reports needing review.
- **Project verification:** project status, confirmation count, required threshold, completion progress, and funding.
- **Latest reports:** recent community messages with confirmation and audit-flag states.
- **Fund utilization:** planned versus disbursed capital over the last six months.
- **Vulnerability watch:** county risk scores with high-risk, watch, and stable indicators.
- **Report intake:** a modal for entering a project code, SMS message, and source phone number. Submitting it produces a confirmation notice.
- **Navigation:** project, report, release, map, verification-rule, and activity-log surfaces are represented as workspace destinations.

## How It Works

```text
Community member
      |
      |  BHR-042 DONE
      v
SMS intake and message validation
      |
      v
Project lookup -> duplicate check -> unique confirmation count
      |
      +--> threshold reached --> Verified project
      |
      +--> DELAYED / PROBLEM --> Audit flag for county review
      |
      v
County and donor dashboard
      |
      v
Approved milestone -> fund release record -> public audit trail
```

### Verification logic

A production report should follow a predictable format such as `BOREHOLE123 DONE` or `WTR-117 DELAYED`. The backend should:

1. Normalize the message and phone number.
2. Validate the project code and allowed report state.
3. Identify the project and county.
4. Reject duplicate submissions from the same reporter for the same milestone.
5. Count unique community confirmations.
6. Mark the project verified when its configured threshold is reached.
7. Create an audit flag for `DELAYED`, `INCOMPLETE`, `PROBLEM`, or other risk states.
8. Send an SMS receipt so the reporter knows the report was recorded.

The dashboard mirrors this logic with examples such as `18 / 12` confirmations and an `In review` state for projects that have not reached their threshold.

## Why This Can Produce Better Results

### Better accountability

Community evidence is attached to a project rather than remaining in an informal conversation. County teams can see which project, milestone, and funding record the evidence concerns.

### Earlier intervention

A delayed or negative report becomes a visible audit flag. This gives officials a chance to inspect a project before the next release instead of discovering the issue after funds are exhausted.

### More reliable verification

A single report is weak evidence. Requiring independent confirmations reduces reliance on one voice and makes it harder for a project to be marked complete without local agreement.

### Faster donor decisions

Donors get project status, confirmation strength, utilization, and risk signals in one view. This reduces manual reconciliation across spreadsheets and helps prioritize site visits and releases.

### Traceable fund releases

A signed release record can link the verified milestone, approval decision, amount, timestamp, and transaction hash. This makes the movement from evidence to payment inspectable.

### Targeted climate response

County vulnerability scores can combine drought, flood, water access, project coverage, and report history. This helps direct scarce finance toward places where exposure and unmet need are highest.

## Production Architecture

The PDF proposes the following target stack:

| Layer | Production responsibility | Suggested technology |
| --- | --- | --- |
| Community channel | Receive and reply to SMS reports | Twilio webhooks |
| API | Validate reports, manage workflows, expose dashboard data | Python and FastAPI |
| Database | Projects, reporters, reports, thresholds, flags, releases | Supabase/PostgreSQL |
| Analytics | Vulnerability scoring, anomaly detection, county comparisons | Python jobs |
| Dashboard | County and donor monitoring experience | React, TypeScript, Tailwind CSS |
| Audit ledger | Record approved releases and verification events | Solidity on Polygon |
| Hosting | Frontend, API, database, and contract deployment | Vercel, cloud server, Supabase, Polygon |

A production request should flow like this:

```text
Twilio webhook -> FastAPI -> PostgreSQL transaction
                         |              |
                         |              +-> SMS receipt
                         +-> verification / anomaly job
                         +-> dashboard event
                         +-> approved release -> Polygon contract
```

## How To Run

From the repository root:

```bash
cd app
npm install
npm run dev
```

Open the local URL printed by Vite. The current environment uses `http://localhost:5174/` when port `5173` is already occupied.

Build a production bundle with:

```bash
npm run build
```

Run the available linter with:

```bash
npm run lint
```

## Backend Service

The backend is deployed with the frontend on Vercel:

| Route | Purpose |
| --- | --- |
| `GET /api/health` | Fast service and database health check |
| `GET /api/dashboard` | Cached dashboard payload for the frontend |
| `GET /api/reports` | Recent report read endpoint |
| `POST /api/reports` | Validate, deduplicate, persist, and transition a report |
| `GET /api/cron/reconcile` | Scheduled stale-flag and project reconciliation |

Configure these Vercel environment variables:

- `DATABASE_URL`: Neon pooled connection string. Without it, reads and report submissions use a non-persistent demo mode.
- `CRON_SECRET`: optional secret used to protect manual cron calls. Vercel automatically sends it for configured cron jobs when set.

Run [`db/schema.sql`](db/schema.sql) once against the Neon database. The API also performs an idempotent schema check on a cold start, which keeps first deployment simple while the warm-instance promise avoids repeating DDL on every request.

### Low-bandwidth and resilience choices

- Dashboard responses use `s-maxage` and `stale-while-revalidate` so repeated visits do not always hit Neon.
- The frontend ships as a static Vite bundle and only requests one compact dashboard payload on load.
- The report endpoint validates before touching the database and uses a unique `(project, reporter, status)` key for idempotent retries.
- Phone numbers are converted into a short reporter key before storage; raw numbers are not written to the database.
- Neon uses a pooled serverless driver and cached client/schema promises to reduce connection setup on warm invocations.
- Read-only dashboard failures return demo data rather than leaving the interface blank. Write failures return `503`, allowing SMS or client retries without pretending the record was saved.
- Vercel's multi-region runtime and the database's durable storage provide redundancy; production deployments should still use Neon branching/backups and monitor the health endpoint.

## Data Model To Add

The prototype should be backed by entities similar to these:

- `projects`: project code, name, county, location, funder, budget, milestone, threshold, and status.
- `reporters`: hashed phone number, consent status, language, community, and last-report timestamp.
- `reports`: project ID, reporter ID, normalized message, status, received time, and moderation state.
- `verification_events`: project ID, unique reporter count, threshold, decision, reviewer, and decision time.
- `audit_flags`: report or project ID, reason, severity, owner, resolution, and resolution time.
- `fund_releases`: project ID, milestone, amount, approver, approval time, transaction hash, and release status.
- `vulnerability_scores`: county, score, source data date, contributing factors, and confidence.

Phone numbers should be hashed or tokenized wherever possible. Raw phone numbers should be restricted to the minimum operational use required for SMS delivery.

## Improvement Roadmap

### Phase 1: Connect the workflow

- Add FastAPI endpoints for SMS webhooks, project lookup, report intake, and dashboard queries.
- Store reports and projects in Supabase/PostgreSQL.
- Implement server-side duplicate detection using a reporter, project, and milestone key.
- Add language-aware SMS responses for English and Kiswahili.
- Add authentication and role-based access for community reviewers, county officers, donors, and administrators.

### Phase 2: Increase verification quality

- Require a configurable number of confirmations from different phone numbers and, where appropriate, different villages.
- Add rate limiting, consent capture, and suspicious-account detection.
- Track report history and reporter reliability without penalizing occasional reporters.
- Add human review queues for ambiguous, contradictory, or high-impact reports.
- Support photo or GPS evidence through a later mobile or WhatsApp channel while keeping SMS available.

### Phase 3: Improve risk detection

- Combine reports with rainfall, drought, flood, water-access, and satellite or field data.
- Explain every vulnerability score using its contributing factors and data freshness.
- Detect unusual patterns such as many reports from one number, repeated identical messages, or progress claims that conflict with field evidence.
- Measure model precision and false-positive rates before using automated flags to block funds.

### Phase 4: Make fund releases auditable

- Define a small Solidity contract for milestone approval, amount, project ID, and evidence hash.
- Keep personal and sensitive data off-chain; store only hashes and references on Polygon.
- Require multi-party approval for releases above a configured amount.
- Add a public read-only release page so donors and communities can inspect release history.
- Add retry and reconciliation handling for failed blockchain transactions.

### Phase 5: Prove impact

Track metrics before and after rollout:

- SMS response time and successful delivery rate.
- Percentage of projects reaching verification thresholds.
- Duplicate and suspicious report detection precision.
- Time from first problem report to county action.
- Percentage of releases with complete evidence and audit records.
- Dashboard load time and uptime.
- Community completion rate and user satisfaction by county and language.

Use a pilot across a small number of counties first. Compare the new process with the existing reporting process, publish the evaluation method, and adjust thresholds with community and county stakeholders.

## Important Prototype Limitations

This repository does not yet include a live Twilio webhook, Python scoring job, or deployed Polygon contract. The Vercel API now handles the core dashboard and report workflow with Neon-ready persistence, but authentication, SMS delivery, rate limiting, queue-backed analytics, and formal release approvals should be added before it is used for real disbursement decisions.
