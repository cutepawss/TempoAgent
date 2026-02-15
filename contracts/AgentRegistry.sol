// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AgentRegistry
 * @notice On-chain registry for AI agents with skill-based trust scoring
 * @dev Deployed on Tempo Testnet (Moderato) — Chain ID 42431
 *
 * Trust Score: 300-900 range
 * Tiers: Bronze (300-499), Silver (500-699), Gold (700-849), Platinum (850-900)
 * Scores are per-skill, not per-agent
 */
contract AgentRegistry {
    // ── Types ───────────────────────────────────────
    enum Tier { Bronze, Silver, Gold, Platinum }

    struct SkillProfile {
        uint256 trustScore;     // 300-900
        uint256 tasksCompleted;
        uint256 tasksFailed;
        uint256 lastUpdated;
    }

    struct AgentInfo {
        address owner;
        string name;
        string[] skills;
        uint256 pricePerTask;   // in token smallest unit (6 decimals for AlphaUSD)
        bool active;
        uint256 registeredAt;
    }

    // ── State ───────────────────────────────────────
    mapping(address => AgentInfo) public agents;
    // agent => skill => SkillProfile
    mapping(address => mapping(string => SkillProfile)) public skillProfiles;
    address[] public agentList;

    address public owner;
    address public qualityOracle; // only QualityOracle can update scores

    uint256 public constant MIN_SCORE = 300;
    uint256 public constant MAX_SCORE = 900;
    uint256 public constant INITIAL_SCORE = 500;
    uint256 public constant MAX_DAILY_GAIN = 5;

    // ── Events ──────────────────────────────────────
    event AgentRegistered(address indexed agent, string name);
    event SkillAdded(address indexed agent, string skill);
    event ScoreUpdated(address indexed agent, string skill, uint256 newScore, int256 delta);
    event AgentDeactivated(address indexed agent);

    // ── Modifiers ───────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyOracle() {
        require(msg.sender == qualityOracle, "Not QualityOracle");
        _;
    }

    // ── Constructor ─────────────────────────────────
    constructor() {
        owner = msg.sender;
    }

    // ── Admin ───────────────────────────────────────
    function setQualityOracle(address _oracle) external onlyOwner {
        qualityOracle = _oracle;
    }

    // ── Registration ────────────────────────────────
    function registerAgent(
        string calldata _name,
        uint256 _pricePerTask,
        string[] calldata _skills
    ) external {
        require(agents[msg.sender].registeredAt == 0, "Already registered");
        require(_skills.length > 0, "Need at least 1 skill");

        agents[msg.sender] = AgentInfo({
            owner: msg.sender,
            name: _name,
            skills: _skills,
            pricePerTask: _pricePerTask,
            active: true,
            registeredAt: block.timestamp
        });

        for (uint i = 0; i < _skills.length; i++) {
            skillProfiles[msg.sender][_skills[i]] = SkillProfile({
                trustScore: INITIAL_SCORE,
                tasksCompleted: 0,
                tasksFailed: 0,
                lastUpdated: block.timestamp
            });
        }

        agentList.push(msg.sender);
        emit AgentRegistered(msg.sender, _name);
    }

    function addSkill(string calldata _skill) external {
        require(agents[msg.sender].registeredAt > 0, "Not registered");
        require(skillProfiles[msg.sender][_skill].lastUpdated == 0, "Skill exists");

        agents[msg.sender].skills.push(_skill);
        skillProfiles[msg.sender][_skill] = SkillProfile({
            trustScore: INITIAL_SCORE,
            tasksCompleted: 0,
            tasksFailed: 0,
            lastUpdated: block.timestamp
        });

        emit SkillAdded(msg.sender, _skill);
    }

    // ── Score Updates (only QualityOracle) ───────────
    // Sybil-resistant: daily gain limited to MAX_DAILY_GAIN
    mapping(address => mapping(string => uint256)) public dailyGainUsed;
    mapping(address => mapping(string => uint256)) public lastGainReset;

    function updateScore(
        address _agent,
        string calldata _skill,
        int256 _delta
    ) external onlyOracle {
        SkillProfile storage profile = skillProfiles[_agent][_skill];
        require(profile.lastUpdated > 0, "Skill not found");

        int256 effectiveDelta = _delta;

        // Enforce daily gain cap for positive deltas
        if (_delta > 0) {
            // Reset daily counter if 24h passed
            if (block.timestamp > lastGainReset[_agent][_skill] + 1 days) {
                dailyGainUsed[_agent][_skill] = 0;
                lastGainReset[_agent][_skill] = block.timestamp;
            }

            uint256 remaining = MAX_DAILY_GAIN > dailyGainUsed[_agent][_skill]
                ? MAX_DAILY_GAIN - dailyGainUsed[_agent][_skill]
                : 0;

            if (uint256(_delta) > remaining) {
                effectiveDelta = int256(remaining);
            }

            if (effectiveDelta > 0) {
                dailyGainUsed[_agent][_skill] += uint256(effectiveDelta);
            }

            profile.tasksCompleted++;
        } else {
            // No cap on penalties — losing trust is immediate
            profile.tasksFailed++;
        }

        int256 newScore = int256(profile.trustScore) + effectiveDelta;

        if (newScore < int256(MIN_SCORE)) newScore = int256(MIN_SCORE);
        if (newScore > int256(MAX_SCORE)) newScore = int256(MAX_SCORE);

        profile.trustScore = uint256(newScore);
        profile.lastUpdated = block.timestamp;

        emit ScoreUpdated(_agent, _skill, uint256(newScore), effectiveDelta);
    }

    // ── Views ───────────────────────────────────────
    function getTier(uint256 _score) public pure returns (Tier) {
        if (_score >= 850) return Tier.Platinum;
        if (_score >= 700) return Tier.Gold;
        if (_score >= 500) return Tier.Silver;
        return Tier.Bronze;
    }

    function getAgentSkillScore(
        address _agent,
        string calldata _skill
    ) external view returns (uint256 score, Tier tier, uint256 completed, uint256 failed) {
        SkillProfile storage p = skillProfiles[_agent][_skill];
        return (p.trustScore, getTier(p.trustScore), p.tasksCompleted, p.tasksFailed);
    }

    function getAgentInfo(address _agent) external view returns (
        string memory name,
        string[] memory skills,
        uint256 pricePerTask,
        bool active,
        uint256 registeredAt
    ) {
        AgentInfo storage a = agents[_agent];
        return (a.name, a.skills, a.pricePerTask, a.active, a.registeredAt);
    }

    function getAgentCount() external view returns (uint256) {
        return agentList.length;
    }

    function needsEscrow(address _agent, string calldata _skill) external view returns (bool) {
        return skillProfiles[_agent][_skill].trustScore < 700;
    }
}
