// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./AgentRegistry.sol";
import "./QualityOracle.sol";

/**
 * @title EscrowVault
 * @notice Adaptive escrow for AI agent payments using TIP-20 tokens
 * @dev Trust-based settlement:
 *   - Score >= 700 (Gold+): Direct payment, no escrow needed
 *   - Score < 700 (Silver/Bronze): Funds held in escrow until quality verified
 *
 * Uses AlphaUSD (TIP-20) on Tempo Testnet
 */

interface ITIP20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

contract EscrowVault {
    // ── Types ───────────────────────────────────────
    enum EscrowStatus { Active, Released, Refunded }

    struct Escrow {
        bytes32 taskId;
        address buyer;
        address agent;
        string skill;
        address token;
        uint256 amount;
        EscrowStatus status;
        uint256 createdAt;
        uint256 resolvedAt;
    }

    // ── State ───────────────────────────────────────
    mapping(bytes32 => Escrow) public escrows;
    bytes32[] public escrowIds;

    AgentRegistry public registry;
    QualityOracle public oracle;
    address public owner;
    mapping(address => bool) public authorizedVerifiers;

    uint256 public totalDeposited;
    uint256 public totalReleased;
    uint256 public totalRefunded;

    // Timeout: if quality check doesn't happen within this time, buyer can refund
    uint256 public escrowTimeout = 30 minutes;

    // ── Events ──────────────────────────────────────
    event EscrowDeposited(bytes32 indexed taskId, address indexed buyer, address agent, uint256 amount);
    event EscrowReleased(bytes32 indexed taskId, address indexed agent, uint256 amount);
    event EscrowRefunded(bytes32 indexed taskId, address indexed buyer, uint256 amount);

    // ── Modifiers ───────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyVerifier() {
        require(authorizedVerifiers[msg.sender] || msg.sender == owner, "Not authorized verifier");
        _;
    }

    // ── Constructor ─────────────────────────────────
    constructor(address _registry, address _oracle) {
        registry = AgentRegistry(_registry);
        oracle = QualityOracle(_oracle);
        owner = msg.sender;
        authorizedVerifiers[msg.sender] = true;
    }

    function addVerifier(address _verifier) external onlyOwner {
        authorizedVerifiers[_verifier] = true;
    }

    // ── Core ────────────────────────────────────────

    /**
     * @notice Deposit funds into escrow for a task
     * @dev Buyer must approve this contract to spend tokens first
     */
    function deposit(
        bytes32 _taskId,
        address _agent,
        string calldata _skill,
        address _token,
        uint256 _amount
    ) external {
        require(escrows[_taskId].createdAt == 0, "Escrow exists");
        require(_amount > 0, "Amount must be > 0");

        // Transfer tokens from buyer to this contract
        ITIP20(_token).transferFrom(msg.sender, address(this), _amount);

        escrows[_taskId] = Escrow({
            taskId: _taskId,
            buyer: msg.sender,
            agent: _agent,
            skill: _skill,
            token: _token,
            amount: _amount,
            status: EscrowStatus.Active,
            createdAt: block.timestamp,
            resolvedAt: 0
        });

        escrowIds.push(_taskId);
        totalDeposited += _amount;

        emit EscrowDeposited(_taskId, msg.sender, _agent, _amount);
    }

    /**
     * @notice Release escrowed funds to agent after quality check passes
     * @dev Can be called by owner/verifier after QualityOracle confirms pass
     */
    function release(bytes32 _taskId) external onlyVerifier {
        Escrow storage e = escrows[_taskId];
        require(e.status == EscrowStatus.Active, "Not active");

        // Verify quality check passed
        (, , , QualityOracle.Verdict verdict, , uint256 timestamp) = oracle.getReport(_taskId);
        require(timestamp > 0, "No quality report");
        require(verdict == QualityOracle.Verdict.Pass, "Quality check failed");

        e.status = EscrowStatus.Released;
        e.resolvedAt = block.timestamp;
        totalReleased += e.amount;

        ITIP20(e.token).transfer(e.agent, e.amount);

        emit EscrowReleased(_taskId, e.agent, e.amount);
    }

    /**
     * @notice Refund buyer if quality check fails or timeout expires
     */
    function refund(bytes32 _taskId) external {
        Escrow storage e = escrows[_taskId];
        require(e.status == EscrowStatus.Active, "Not active");

        bool isTimeout = block.timestamp > e.createdAt + escrowTimeout;
        bool isOwnerCall = msg.sender == owner;

        // Check if quality failed
        (, , , QualityOracle.Verdict verdict, , uint256 timestamp) = oracle.getReport(_taskId);
        bool qualityFailed = timestamp > 0 && verdict != QualityOracle.Verdict.Pass;

        require(isTimeout || isOwnerCall || qualityFailed, "Cannot refund yet");

        e.status = EscrowStatus.Refunded;
        e.resolvedAt = block.timestamp;
        totalRefunded += e.amount;

        ITIP20(e.token).transfer(e.buyer, e.amount);

        emit EscrowRefunded(_taskId, e.buyer, e.amount);
    }

    // ── Views ───────────────────────────────────────
    function getEscrow(bytes32 _taskId) external view returns (
        address buyer,
        address agent,
        uint256 amount,
        EscrowStatus status,
        uint256 createdAt
    ) {
        Escrow storage e = escrows[_taskId];
        return (e.buyer, e.agent, e.amount, e.status, e.createdAt);
    }

    function needsEscrow(address _agent, string calldata _skill) external view returns (bool) {
        return registry.needsEscrow(_agent, _skill);
    }

    function getStats() external view returns (
        uint256 deposited,
        uint256 released,
        uint256 refunded,
        uint256 activeCount
    ) {
        uint256 active = 0;
        for (uint i = 0; i < escrowIds.length; i++) {
            if (escrows[escrowIds[i]].status == EscrowStatus.Active) active++;
        }
        return (totalDeposited, totalReleased, totalRefunded, active);
    }

    // ── Admin ───────────────────────────────────────
    function setEscrowTimeout(uint256 _timeout) external onlyOwner {
        escrowTimeout = _timeout;
    }
}
