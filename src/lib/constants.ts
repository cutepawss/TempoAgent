// Tempo Testnet Token Addresses (TIP-20)
export const TOKENS = {
    ALPHA_USD: '0x20c0000000000000000000000000000000000001' as `0x${string}`,
    BETA_USD: '0x20c0000000000000000000000000000000000002' as `0x${string}`,
    THETA_USD: '0x20c0000000000000000000000000000000000003' as `0x${string}`,
    PATH_USD: '0x20c0000000000000000000000000000000000000' as `0x${string}`,
};

// Deployed Smart Contracts (Tempo Testnet — Moderato) — v2 with fixes
export const CONTRACTS = {
    AGENT_REGISTRY: '0xeae0ea590279d85df79cc1faf4abf27b09ad928a' as `0x${string}`,
    QUALITY_ORACLE: '0x5405e26da23a621b5c8cd282301e79d2b73ba0ea' as `0x${string}`,
    ESCROW_VAULT: '0xe50759ce0adcdf6d4e3ba044563e0293cab06736' as `0x${string}`,
};

// Tempo Testnet Core
export const TEMPO = {
    CHAIN_ID: 42431,
    RPC: 'https://rpc.moderato.tempo.xyz',
    EXPLORER: 'https://explore.tempo.xyz',
    SPONSOR: 'https://sponsor.testnet.tempo.xyz',
};

// Agent wallet (deployer)
export const AGENT_WALLET = '0x031891A61200FedDd622EbACC10734BC90093B2A';

// Agent receiver
export const AGENT_RECEIVER = '0xAcF8dBD0352a9D47135DA146EA5DbEfAD58340C4';
