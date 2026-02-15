// Contract ABIs — extracted from compiled Hardhat artifacts
// Used for real on-chain interactions from frontend and API routes

// ── AgentRegistry ────────────────────────────────────
export const agentRegistryAbi = [
    {
        name: 'getAgentSkillScore',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: '_agent', type: 'address' },
            { name: '_skill', type: 'string' },
        ],
        outputs: [
            { name: 'score', type: 'uint256' },
            { name: 'tier', type: 'uint8' },
            { name: 'completed', type: 'uint256' },
            { name: 'failed', type: 'uint256' },
        ],
    },
    {
        name: 'getAgentInfo',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: '_agent', type: 'address' }],
        outputs: [
            { name: 'name', type: 'string' },
            { name: 'skills', type: 'string[]' },
            { name: 'pricePerTask', type: 'uint256' },
            { name: 'active', type: 'bool' },
            { name: 'registeredAt', type: 'uint256' },
        ],
    },
    {
        name: 'getAgentCount',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'needsEscrow',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: '_agent', type: 'address' },
            { name: '_skill', type: 'string' },
        ],
        outputs: [{ name: '', type: 'bool' }],
    },
    {
        name: 'getTier',
        type: 'function',
        stateMutability: 'pure',
        inputs: [{ name: '_score', type: 'uint256' }],
        outputs: [{ name: '', type: 'uint8' }],
    },
    {
        name: 'agentList',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: '', type: 'uint256' }],
        outputs: [{ name: '', type: 'address' }],
    },
] as const;

// ── QualityOracle ────────────────────────────────────
export const qualityOracleAbi = [
    {
        name: 'submitReport',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: '_taskId', type: 'bytes32' },
            { name: '_agent', type: 'address' },
            { name: '_skill', type: 'string' },
            { name: '_confidence', type: 'uint8' },
            { name: '_verdict', type: 'uint8' },
            { name: '_reason', type: 'string' },
        ],
        outputs: [],
    },
    {
        name: 'getReport',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: '_taskId', type: 'bytes32' }],
        outputs: [
            { name: 'agent', type: 'address' },
            { name: 'skill', type: 'string' },
            { name: 'confidence', type: 'uint8' },
            { name: 'verdict', type: 'uint8' },
            { name: 'reason', type: 'string' },
            { name: 'timestamp', type: 'uint256' },
        ],
    },
    {
        name: 'getStats',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [
            { name: 'total', type: 'uint256' },
            { name: 'passed', type: 'uint256' },
            { name: 'failed', type: 'uint256' },
            { name: 'passRate', type: 'uint256' },
        ],
    },
    {
        name: 'getReportCount',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'totalReports',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'totalPassed',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
    },
    // Events for filtering
    {
        name: 'ReportSubmitted',
        type: 'event',
        inputs: [
            { name: 'taskId', type: 'bytes32', indexed: true },
            { name: 'agent', type: 'address', indexed: true },
            { name: 'skill', type: 'string', indexed: false },
            { name: 'verdict', type: 'uint8', indexed: false },
            { name: 'confidence', type: 'uint8', indexed: false },
        ],
    },
] as const;

// ── EscrowVault ──────────────────────────────────────
export const escrowVaultAbi = [
    {
        name: 'deposit',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: '_taskId', type: 'bytes32' },
            { name: '_agent', type: 'address' },
            { name: '_skill', type: 'string' },
            { name: '_token', type: 'address' },
            { name: '_amount', type: 'uint256' },
        ],
        outputs: [],
    },
    {
        name: 'release',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: '_taskId', type: 'bytes32' }],
        outputs: [],
    },
    {
        name: 'refund',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: '_taskId', type: 'bytes32' }],
        outputs: [],
    },
    {
        name: 'getEscrow',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: '_taskId', type: 'bytes32' }],
        outputs: [
            { name: 'buyer', type: 'address' },
            { name: 'agent', type: 'address' },
            { name: 'amount', type: 'uint256' },
            { name: 'status', type: 'uint8' },
            { name: 'createdAt', type: 'uint256' },
        ],
    },
    {
        name: 'getStats',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [
            { name: 'deposited', type: 'uint256' },
            { name: 'released', type: 'uint256' },
            { name: 'refunded', type: 'uint256' },
            { name: 'activeCount', type: 'uint256' },
        ],
    },
    {
        name: 'needsEscrow',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: '_agent', type: 'address' },
            { name: '_skill', type: 'string' },
        ],
        outputs: [{ name: '', type: 'bool' }],
    },
    // Events
    {
        name: 'EscrowDeposited',
        type: 'event',
        inputs: [
            { name: 'taskId', type: 'bytes32', indexed: true },
            { name: 'buyer', type: 'address', indexed: true },
            { name: 'agent', type: 'address', indexed: false },
            { name: 'amount', type: 'uint256', indexed: false },
        ],
    },
    {
        name: 'EscrowReleased',
        type: 'event',
        inputs: [
            { name: 'taskId', type: 'bytes32', indexed: true },
            { name: 'agent', type: 'address', indexed: true },
            { name: 'amount', type: 'uint256', indexed: false },
        ],
    },
] as const;
