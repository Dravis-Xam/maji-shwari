import { expect } from 'chai'
import { ethers } from 'hardhat'
import { AuditLedger__factory, type AuditLedger } from '../typechain-types'
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'

describe('AuditLedger', () => {
  let ledger: AuditLedger
  let owner: HardhatEthersSigner
  let county: HardhatEthersSigner
  let donor: HardhatEthersSigner
  let stranger: HardhatEthersSigner

  const MULTI_APPROVAL_THRESHOLD_CENTS = 500_000_00 // KES 500,000 in cents

  beforeEach(async () => {
    ;[owner, county, donor, stranger] = await ethers.getSigners()
    ledger = await new AuditLedger__factory(owner).deploy(
      [county.address, donor.address],
      MULTI_APPROVAL_THRESHOLD_CENTS,
    )
  })

  it('registers the initial approvers and owner', async () => {
    expect(await ledger.owner()).to.equal(owner.address)
    expect(await ledger.isApprover(county.address)).to.equal(true)
    expect(await ledger.isApprover(donor.address)).to.equal(true)
    expect(await ledger.approverCount()).to.equal(2)
  })

  it('lets the owner add and remove approvers', async () => {
    await expect(ledger.connect(owner).addApprover(stranger.address))
      .to.emit(ledger, 'ApproverAdded')
      .withArgs(stranger.address)
    expect(await ledger.isApprover(stranger.address)).to.equal(true)

    await expect(ledger.connect(owner).removeApprover(stranger.address))
      .to.emit(ledger, 'ApproverRemoved')
      .withArgs(stranger.address)
    expect(await ledger.isApprover(stranger.address)).to.equal(false)
  })

  it('rejects approver management from a non-owner', async () => {
    await expect(ledger.connect(stranger).addApprover(stranger.address)).to.be.revertedWith(
      'AuditLedger: caller is not the owner',
    )
  })

  it('records a release immediately once required approvals are met (below threshold)', async () => {
    const amountCents = 100_000_00 // below the multi-approval threshold
    const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes('evidence-bundle-1'))

    expect(await ledger.requiredApprovals(amountCents)).to.equal(1)

    const tx = await ledger.connect(county).proposeRelease('BHR-042', 'milestone 1 of 3', amountCents, evidenceHash)
    await expect(tx).to.emit(ledger, 'ReleaseRecorded')

    expect(await ledger.releaseCount()).to.equal(1)
    const release = await ledger.getRelease(0)
    expect(release.projectId).to.equal('BHR-042')
    expect(release.milestone).to.equal('milestone 1 of 3')
    expect(release.amountCents).to.equal(amountCents)
    expect(release.evidenceHash).to.equal(evidenceHash)
    expect(release.approvedAt).to.be.greaterThan(0)
    expect(release.approvers).to.deep.equal([county.address])
  })

  it('requires a second approver for releases at or above the threshold', async () => {
    const amountCents = MULTI_APPROVAL_THRESHOLD_CENTS
    const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes('evidence-bundle-2'))

    expect(await ledger.requiredApprovals(amountCents)).to.equal(2)

    const proposeTx = await ledger
      .connect(county)
      .proposeRelease('WTR-117', 'milestone 2 of 3', amountCents, evidenceHash)
    const receipt = await proposeTx.wait()
    const proposedEvent = receipt!.logs
      .map((log) => {
        try {
          return ledger.interface.parseLog(log)
        } catch {
          return null
        }
      })
      .find((event) => event?.name === 'ReleaseProposed')
    const proposalId = proposedEvent!.args.proposalId as string

    // Only one approval so far — not yet finalized.
    expect(await ledger.releaseCount()).to.equal(0)

    await expect(ledger.connect(donor).approveRelease(proposalId)).to.emit(ledger, 'ReleaseRecorded')

    expect(await ledger.releaseCount()).to.equal(1)
    const release = await ledger.getRelease(0)
    expect(release.approvers).to.deep.equal([county.address, donor.address])
  })

  it('rejects a non-approver trying to propose or approve a release', async () => {
    const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes('evidence-bundle-3'))
    await expect(
      ledger.connect(stranger).proposeRelease('FRM-089', 'milestone 3 of 3', 100, evidenceHash),
    ).to.be.revertedWith('AuditLedger: caller is not an approver')
  })

  it('prevents the same approver from approving a proposal twice', async () => {
    const amountCents = MULTI_APPROVAL_THRESHOLD_CENTS
    const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes('evidence-bundle-4'))
    await ledger.connect(county).proposeRelease('BHR-042', 'milestone 1 of 3', amountCents, evidenceHash)

    // county already auto-approved as the proposer; approving again should revert.
    const filter = ledger.filters.ReleaseProposed()
    const events = await ledger.queryFilter(filter)
    const proposalId = events[events.length - 1].args.proposalId

    await expect(ledger.connect(county).approveRelease(proposalId)).to.be.revertedWith(
      'AuditLedger: already approved by caller',
    )
  })
})