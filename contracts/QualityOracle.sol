// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./AgentRegistry.sol";

/**
 * @title QualityOracle
 * @notice Records AI output quality checks and updates agent trust scores
 * @dev Works with AgentRegistry for score updates
 *
 * Quality pass:        +2 score
 * Quality fail:       -10 score
 * Hallucination flag: -25 score
 */
contract QualityOracle {
    // ── Types ───────────────────────────────────────
    enum Verdict { Pass, Fail, Hallucination }

    struct QualityReport {
        bytes32 taskId;
        address agent;
        string skill;
        uint8 confidence;      // 0-100
        Verdict verdict;
        string reason;
        uint256 timestamp;
    }

    // ── State ───────────────────────────────────────
    mapping(bytes32 => QualityReport) public reports;
    bytes32[] public reportIds;

    AgentRegistry public registry;
    address public owner;
    mapping(address => bool) public authorizedVerifiers;

    // Score deltas
    int256 public constant PASS_DELTA = 2;
    int256 public constant FAIL_DELTA = -10;
    int256 public constant HALLUCINATION_DELTA = -25;

    // Stats
    uint256 public totalReports;
    uint256 public totalPassed;
    uint256 public totalFailed;

    // ── Events ──────────────────────────────────────
    event ReportSubmitted(
        bytes32 indexed taskId,
        address indexed agent,
        string skill,
        Verdict verdict,
        uint8 confidence
    );

    // ── Modifiers ───────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyVerifier() {
        require(authorizedVerifiers[msg.sender] || msg.sender == owner, "Not authorized");
        _;
    }

    // ── Constructor ─────────────────────────────────
    constructor(address _registry) {
        registry = AgentRegistry(_registry);
        owner = msg.sender;
        authorizedVerifiers[msg.sender] = true;
    }

    // ── Admin ───────────────────────────────────────
    function addVerifier(address _verifier) external onlyOwner {
        authorizedVerifiers[_verifier] = true;
    }

    // ── Core ────────────────────────────────────────
    function submitReport(
        bytes32 _taskId,
        address _agent,
        string calldata _skill,
        uint8 _confidence,
        Verdict _verdict,
        string calldata _reason
    ) external onlyVerifier {
        require(reports[_taskId].timestamp == 0, "Report exists");

        reports[_taskId] = QualityReport({
            taskId: _taskId,
            agent: _agent,
            skill: _skill,
            confidence: _confidence,
            verdict: _verdict,
            reason: _reason,
            timestamp: block.timestamp
        });

        reportIds.push(_taskId);
        totalReports++;

        // Update agent score based on verdict
        int256 delta;
        if (_verdict == Verdict.Pass) {
            delta = PASS_DELTA;
            totalPassed++;
        } else if (_verdict == Verdict.Fail) {
            delta = FAIL_DELTA;
            totalFailed++;
        } else {
            delta = HALLUCINATION_DELTA;
            totalFailed++;
        }

        registry.updateScore(_agent, _skill, delta);

        emit ReportSubmitted(_taskId, _agent, _skill, _verdict, _confidence);
    }

    // ── Views ───────────────────────────────────────
    function getReport(bytes32 _taskId) external view returns (
        address agent,
        string memory skill,
        uint8 confidence,
        Verdict verdict,
        string memory reason,
        uint256 timestamp
    ) {
        QualityReport storage r = reports[_taskId];
        return (r.agent, r.skill, r.confidence, r.verdict, r.reason, r.timestamp);
    }

    function getStats() external view returns (
        uint256 total,
        uint256 passed,
        uint256 failed,
        uint256 passRate
    ) {
        uint256 rate = totalReports > 0 ? (totalPassed * 100) / totalReports : 0;
        return (totalReports, totalPassed, totalFailed, rate);
    }

    function getReportCount() external view returns (uint256) {
        return reportIds.length;
    }
}
