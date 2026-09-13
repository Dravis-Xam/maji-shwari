# MajiShwari smart contracts

The `AuditLedger` contract is the on-chain "audit ledger" layer described in
the main project README's production architecture: a small, public,
tamper-evident record of approved milestone fund releases. It intentionally
stores as little as possible — a project code, a milestone label, an amount,
and a hash of the off-chain evidence bundle. No names, phone numbers, or
reporter identities ever touch the chain.

## How it works

- An **owner** (deployer) manages a set of **approvers** — wallets
  representing county officials, donors, or other authorized signers.
- Any approver can **propose** a release (`proposeRelease`), which also
  counts as that approver's own approval.
- Releases below `multiApprovalThresholdCents` finalize immediately with one
  approval. Releases at or above that threshold need a **second** approver to
  call `approveRelease` before the release is recorded.
- Once finalized, a release is pushed into a public, append-only list
  readable via `releaseCount()` / `getRelease(index)` — this is what a public
  audit page would read from.

This mirrors the off-chain `fund_releases` table in `db/schema.sql`: the
Postgres row is the operational record; the chain entry is the tamper-evident
public receipt, linked by `projectId` + `milestone` and the evidence hash.

## Project layout

```
smart-contracts/
  contracts/AuditLedger.sol   the contract
  tests/AuditLedger.test.ts   Hardhat + Chai test suite
  scripts/deploy_localhost.ts local-chain deploy (single approver = deployer)
  scripts/deploy_prod.ts      Amoy/Polygon deploy, verification, Ethernal sync
  hardhat.config.ts           networks, solc version, Ethernal wiring
```

## Local development

```bash
cd smart-contracts
npm install
cp .env.example .env   # optional for local-only work

# Compile
npm run compile

# Run the test suite
npm test

# Start a local chain in one terminal
npm run node

# Deploy AuditLedger to it in another terminal
npm run deploy:local
```

## Local block explorer (Ethernal)

1. Create an account and workspace at <https://app.tryethernal.com/>.
2. Set `ETHERNAL_EMAIL`, `ETHERNAL_PASSWORD`, and `ETHERNAL_WORKSPACE` in `.env`.
3. Ethernal syncing is enabled automatically once `ETHERNAL_EMAIL` is set (see
   the `ethernal` block in `hardhat.config.ts`) — deployments and
   transactions against your local chain will show up in the workspace
   dashboard at <https://app.tryethernal.com/>.

## Deploying to Polygon

1. Set `PRIVATE_KEY_DEPLOYER`, `AUDIT_LEDGER_APPROVERS` (comma-separated
   addresses), and optionally `AUDIT_LEDGER_THRESHOLD_CENTS` in `.env`.
2. Testnet first:
   ```bash
   npm run deploy:amoy
   ```
3. Once verified on Amoy, mainnet:
   ```bash
   npm run deploy:polygon
   ```
4. Set `POLYGONSCAN_API_KEY` beforehand to have the script automatically
   verify the deployed contract's source on Polygonscan.

## Notes

- The contract is deliberately minimal for a first version: no timelocks, no
  role renunciation flow beyond `addApprover`/`removeApprover`, no pausing.
  Treat it as the audit-trail primitive to build on, not a full treasury
  contract — it never holds or moves funds itself.
- `multiApprovalThresholdCents` and the approver set are both owner-adjustable
  after deployment (`setMultiApprovalThreshold`, `addApprover`,
  `removeApprover`), so policy changes don't require a redeploy.
