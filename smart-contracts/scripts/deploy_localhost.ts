import { ethers } from 'hardhat'

// Deploys AuditLedger to a local Hardhat/localhost chain for development.
// Run with: npx hardhat run scripts/deploy_localhost.ts --network localhost
async function main() {
  const [deployer] = await ethers.getSigners()
  console.log('Deploying AuditLedger with account:', deployer.address)

  // On a local chain, the deployer is also the sole initial approver so you
  // can immediately call proposeRelease/approveRelease while testing.
  const initialApprovers = [deployer.address]
  const multiApprovalThresholdCents = 500_000_00 // KES 500,000

  const AuditLedger = await ethers.getContractFactory('AuditLedger')
  const ledger = await AuditLedger.deploy(initialApprovers, multiApprovalThresholdCents)
  await ledger.waitForDeployment()

  const address = await ledger.getAddress()
  console.log('AuditLedger deployed to:', address)
  console.log('Initial approvers:', initialApprovers)
  console.log('Multi-approval threshold (KES cents):', multiApprovalThresholdCents)

  return { ledger, address }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
