import { ethers, network, run } from 'hardhat'
import hre from 'hardhat'

// Deploys AuditLedger to a real EVM-compatible chain (Polygon Amoy testnet or
// Polygon PoS mainnet, as configured in hardhat.config.ts).
// Run with: npx hardhat run scripts/deploy_prod.ts --network polygonAmoy
async function main() {
  const [deployer] = await ethers.getSigners()
  console.log(`Deploying AuditLedger to ${network.name} with account:`, deployer.address)

  const approversEnv = process.env.AUDIT_LEDGER_APPROVERS ?? ''
  const initialApprovers = approversEnv
    .split(',')
    .map((address) => address.trim())
    .filter(Boolean)

  if (initialApprovers.length === 0) {
    throw new Error(
      'Set AUDIT_LEDGER_APPROVERS to a comma-separated list of approver addresses (e.g. county + donor signer wallets) before deploying to production.',
    )
  }

  const multiApprovalThresholdCents = Number(process.env.AUDIT_LEDGER_THRESHOLD_CENTS ?? 500_000_00)

  const AuditLedger = await ethers.getContractFactory('AuditLedger')
  const ledger = await AuditLedger.deploy(initialApprovers, multiApprovalThresholdCents)
  await ledger.waitForDeployment()

  const address = await ledger.getAddress()
  console.log('AuditLedger deployed to:', address)
  console.log('Initial approvers:', initialApprovers)
  console.log('Multi-approval threshold (KES cents):', multiApprovalThresholdCents)

  // Push the deployment to Ethernal so it shows up in the workspace dashboard,
  // if credentials are configured (safe no-op otherwise).
  if (process.env.ETHERNAL_EMAIL) {
    await hre.ethernal.push({
      name: 'AuditLedger',
      address,
    })
    console.log('Synced deployment to Ethernal.')
  }

  // Verify on the relevant block explorer (Polygonscan) if an API key is set
  // and this isn't the local/hardhat network.
  if (process.env.POLYGONSCAN_API_KEY && network.name !== 'hardhat' && network.name !== 'localhost') {
    console.log('Waiting for block confirmations before verifying...')
    await ledger.deploymentTransaction()?.wait(5)
    try {
      await run('verify:verify', {
        address,
        constructorArguments: [initialApprovers, multiApprovalThresholdCents],
      })
    } catch (error) {
      console.warn('Contract verification failed (deployment still succeeded):', error)
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})