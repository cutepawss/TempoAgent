import { defineChain } from 'viem';

export const tempoTestnet = defineChain({
    id: 42431,
    name: 'Tempo Testnet',
    nativeCurrency: {
        name: 'USD',
        symbol: 'USD',
        decimals: 18,
    },
    rpcUrls: {
        default: {
            http: ['https://rpc.moderato.tempo.xyz'],
        },
    },
    blockExplorers: {
        default: {
            name: 'Tempo Explorer',
            url: 'https://explore.tempo.xyz',
        },
    },
});

// TIP-20 ABI — includes standard functions + Tempo memo-enabled transfer
export const tip20Abi = [
    {
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'decimals',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint8' }],
    },
    {
        name: 'symbol',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'string' }],
    },
    // Standard ERC-20 transfer
    {
        name: 'transfer',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'bool' }],
    },
    // TIP-20 transfer with 32-byte memo for reconciliation
    {
        name: 'transfer',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' },
            { name: 'memo', type: 'bytes32' },
        ],
        outputs: [{ name: '', type: 'bool' }],
    },
] as const;
