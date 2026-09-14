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

## Up next (not started)

- [x] Add a Solidity smart contract for the audit ledger, run in a Hardhat
      environment set up via Polygon's dApp Launchpad, with Ethernal wired up
      as a local block explorer for indexed transactions during development.
      Covers: scaffolding `smart-contracts/` with Hardhat + tests/deploy
      scripts, local-chain deployment via `dapp-launchpad dev`, an Ethernal
      account/workspace for the local explorer, and a production deploy path
      (`dapp-launchpad deploy -n <CHAIN-NAME>`) to an EVM-compatible chain.
      This is the "Audit ledger" layer from the production architecture table
      in the README (currently marked "not yet").
- [ ] UI/UX and workflow pass (before Twilio):
x  1. On project creation, auto-generate the project code in the existing
     format (e.g. `BHR-042`) instead of a free-text field; change the
     "Artifacts" input from a text field to a real file upload.
x  2. Submit buttons should be disabled until all required fields on that
     form are filled — some already do this; extend the same pattern to
     every form-submitting button. Also guard every one of them against
     double-submission (no more than one request per click, e.g. disable
     while the request is in flight).
x  3. After submitting a report, creating a project, or handling an alert,
     show a follow-up confirmation page/screen summarizing the action taken
     and current progress, instead of just a toast.
x  4. Add an "Activities" tab to track all ongoing/pending work in one place:
     projects, alert handling, and funding requests/processing.
x  5. When a project owner requests funding, donors' dashboards should show
     it as a card they can click into for full details, with options to
     join and fund.
x  6. On the community-member and government dashboards, projects should be
     clickable, opening a detail page (id, name, creation date, estimated
     completion date, artifacts, gallery) — all fields editable/addable if
     missing, except the auto-generated id.
x  7. In the Activity log, the arrow icon should open a side panel with full
     details of that activity entry, instead of doing nothing.
x  8. Replace the profile icon in the header with a theme picker: light,
     dark, light-sapphire, and dark-sapphire modes.
  9. Make notifications functional: live events from the API pushed over a
     WebSocket. UI: click a notification to view the full message and mark
     it read; a "clear all" button; and a per-item "x" that appears on
     hover to dismiss that one notification.
  10. Add clear, intuitive hover effects throughout (buttons, rows, cards).
  11. Add a page explaining blockchain to end users in plain terms, plus a
      flow for setting up and linking their own wallet to the app for use
      in funding.
  12. Add an M-Pesa integration to move funds from a donor to a specific
      project owner directly.
- [ ] Add a real USSD channel for community reports using Twilio on the
      Safaricom network, replacing the SMS-format report intake's manual
      typing with a menu-driven USSD session (dial a short code, select
      project/status from a menu, get an immediate on-screen confirmation
      instead of waiting for an SMS receipt). Covers: a Twilio USSD/Programmable
      Messaging webhook endpoint, session-state handling across USSD menu
      steps, mapping USSD input to the existing report validation pipeline
      (`projects` lookup, duplicate check, unique confirmation count,
      threshold/audit-flag logic already in `_lib/db.ts`), and Safaricom
      short-code provisioning through Twilio. This is the "Community channel"
      layer from the production architecture table in the README (currently
      marked "not yet" / SMS-only).