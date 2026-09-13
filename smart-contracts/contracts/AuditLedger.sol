// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AuditLedger
/// @notice Records approved MajiShwari fund releases on-chain as a public,
///         tamper-evident audit trail. Only a hash of the off-chain evidence
///         bundle is stored here — project codes, milestones, and amounts are
///         non-sensitive by design, and no personal data (names, phone
///         numbers, reporter identities) is ever written to this contract.
///         Releases at or above `multiApprovalThresholdCents` require
///         approval from more than one approver before being recorded.
contract AuditLedger {
    struct Release {
        string projectId;
        string milestone;
        uint256 amountCents;
        bytes32 evidenceHash;
        uint256 approvedAt;
        address[] approvers;
    }

    address public owner;
    uint256 public multiApprovalThresholdCents;
    uint256 public approverCount;

    mapping(address => bool) public isApprover;
    mapping(bytes32 => bool) public proposalExists;
    mapping(bytes32 => uint256) public approvalCount;
    mapping(bytes32 => mapping(address => bool)) public hasApproved;
    mapping(bytes32 => Release) private pendingReleases;

    Release[] private releases;

    event ApproverAdded(address indexed approver);
    event ApproverRemoved(address indexed approver);
    event ThresholdUpdated(uint256 newThresholdCents);
    event ReleaseProposed(
        bytes32 indexed proposalId,
        string projectId,
        string milestone,
        uint256 amountCents,
        bytes32 evidenceHash,
        address indexed proposer
    );
    event ReleaseApproved(bytes32 indexed proposalId, address indexed approver, uint256 approvals, uint256 required);
    event ReleaseRecorded(
        uint256 indexed releaseIndex,
        bytes32 indexed proposalId,
        string projectId,
        string milestone,
        uint256 amountCents,
        bytes32 evidenceHash
    );

    modifier onlyOwner() {
        require(msg.sender == owner, 'AuditLedger: caller is not the owner');
        _;
    }

    modifier onlyApprover() {
        require(isApprover[msg.sender], 'AuditLedger: caller is not an approver');
        _;
    }

    constructor(address[] memory initialApprovers, uint256 initialThresholdCents) {
        owner = msg.sender;
        multiApprovalThresholdCents = initialThresholdCents;
        for (uint256 i = 0; i < initialApprovers.length; i++) {
            _addApprover(initialApprovers[i]);
        }
    }

    /// @notice Add a new authorized approver (e.g. a county or donor signer).
    function addApprover(address account) external onlyOwner {
        _addApprover(account);
    }

    /// @notice Revoke an approver's ability to approve future releases.
    function removeApprover(address account) external onlyOwner {
        require(isApprover[account], 'AuditLedger: not an approver');
        isApprover[account] = false;
        approverCount -= 1;
        emit ApproverRemoved(account);
    }

    /// @notice Change the amount, at or above which, a release needs a second approver.
    function setMultiApprovalThreshold(uint256 newThresholdCents) external onlyOwner {
        multiApprovalThresholdCents = newThresholdCents;
        emit ThresholdUpdated(newThresholdCents);
    }

    /// @notice Number of approvals a release of this amount currently requires.
    function requiredApprovals(uint256 amountCents) public view returns (uint256) {
        return amountCents >= multiApprovalThresholdCents ? 2 : 1;
    }

    /// @notice Propose a milestone release and cast the proposer's own approval.
    /// @param projectId Project code, e.g. "BHR-042".
    /// @param milestone Milestone label, e.g. "milestone 1 of 3".
    /// @param amountCents Amount in KES cents, matching the Postgres `amount_cents` column.
    /// @param evidenceHash keccak256 (or similarly derived) hash of the off-chain evidence bundle.
    function proposeRelease(
        string calldata projectId,
        string calldata milestone,
        uint256 amountCents,
        bytes32 evidenceHash
    ) external onlyApprover returns (bytes32 proposalId) {
        proposalId = keccak256(
            abi.encodePacked(projectId, milestone, amountCents, evidenceHash, block.timestamp, msg.sender)
        );
        require(!proposalExists[proposalId], 'AuditLedger: duplicate proposal');

        proposalExists[proposalId] = true;
        Release storage pending = pendingReleases[proposalId];
        pending.projectId = projectId;
        pending.milestone = milestone;
        pending.amountCents = amountCents;
        pending.evidenceHash = evidenceHash;

        emit ReleaseProposed(proposalId, projectId, milestone, amountCents, evidenceHash, msg.sender);
        _approve(proposalId);
    }

    /// @notice Add a second (or later) approval to an existing proposal.
    function approveRelease(bytes32 proposalId) external onlyApprover {
        require(proposalExists[proposalId], 'AuditLedger: unknown proposal');
        require(pendingReleases[proposalId].approvedAt == 0, 'AuditLedger: already finalized');
        _approve(proposalId);
    }

    function _approve(bytes32 proposalId) private {
        require(!hasApproved[proposalId][msg.sender], 'AuditLedger: already approved by caller');
        hasApproved[proposalId][msg.sender] = true;
        approvalCount[proposalId] += 1;
        pendingReleases[proposalId].approvers.push(msg.sender);

        uint256 required = requiredApprovals(pendingReleases[proposalId].amountCents);
        emit ReleaseApproved(proposalId, msg.sender, approvalCount[proposalId], required);

        if (approvalCount[proposalId] >= required) {
            Release storage pending = pendingReleases[proposalId];
            pending.approvedAt = block.timestamp;
            releases.push(pending);
            uint256 releaseIndex = releases.length - 1;
            emit ReleaseRecorded(
                releaseIndex,
                proposalId,
                pending.projectId,
                pending.milestone,
                pending.amountCents,
                pending.evidenceHash
            );
        }
    }

    /// @notice Total number of finalized, on-chain releases.
    function releaseCount() external view returns (uint256) {
        return releases.length;
    }

    /// @notice Read a finalized release by index, for the public audit page.
    function getRelease(
        uint256 index
    )
        external
        view
        returns (
            string memory projectId,
            string memory milestone,
            uint256 amountCents,
            bytes32 evidenceHash,
            uint256 approvedAt,
            address[] memory approvers
        )
    {
        Release storage release = releases[index];
        return (
            release.projectId,
            release.milestone,
            release.amountCents,
            release.evidenceHash,
            release.approvedAt,
            release.approvers
        );
    }

    function _addApprover(address account) private {
        require(account != address(0), 'AuditLedger: zero address');
        if (!isApprover[account]) {
            isApprover[account] = true;
            approverCount += 1;
            emit ApproverAdded(account);
        }
    }
}
