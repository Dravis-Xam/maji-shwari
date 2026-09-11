# MajiShwari implementation tasks

Tasks extracted from `CLIMATE FINANCE VERIFICATION PLATFORM.pdf` and executed in the prototype:

- [x] Create a React dashboard for county officials and climate-finance donors.
- [x] Represent project verification using independent community confirmations and thresholds.
- [x] Add SMS report intake with validation-oriented fields and confirmation feedback.
- [x] Surface audit flags for delayed/problem reports and reports needing review.
- [x] Track monitored capital and disbursement against planned utilization.
- [x] Add vulnerability watch visualization for county-level risk scoring.
- [x] Provide navigation surfaces for projects, reports, fund releases, maps, rules, and activity.
- [x] Keep the prototype runnable without external Twilio, Supabase, FastAPI, or Polygon credentials.
- [x] Add Vercel API routes for health, dashboard reads, and report writes.
- [x] Add Neon/PostgreSQL schema, duplicate-safe report persistence, and verification state transitions.
- [x] Add cached dashboard responses, warm connection/schema reuse, and demo fallback reads.
- [x] Add a Hobby-compatible daily Vercel cron for stale audit and project reconciliation.
- [x] Wire the frontend report intake and dashboard loading to the backend service.
- [x] Back every user dashboard tab with a shared workspace API payload.
- [x] Persist fund releases, vulnerability scores, and activity events in Neon-ready tables.
- [x] Add signed role sessions and server-side role authorization.
- [x] Add project creation, donor funding requests, donor RODs, and lifecycle validation.
- [x] Refresh report and project state changes in the dashboard UI.
- [x] Add approved-role onboarding after Google OAuth.
- [x] Add first-login project prompt and role-specific interface tour.

Run from `app/` with:

```bash
npm run dev
npm run build
```
