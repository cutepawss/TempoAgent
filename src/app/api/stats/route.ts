import { NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { tempoTestnet } from '@/lib/tempo';
import { CONTRACTS } from '@/lib/constants';
import { qualityOracleAbi, agentRegistryAbi } from '@/lib/abis';

/**
 * GET /api/stats
 * Reads real on-chain stats from QualityOracle and AgentRegistry
 * Returns: { totalReports, totalPassed, totalFailed, passRate, agentCount, onChain }
 */
export async function GET() {
    try {
        const publicClient = createPublicClient({
            chain: tempoTestnet,
            transport: http(),
        });

        // Read QualityOracle stats
        const [total, passed, failed, passRate] = await publicClient.readContract({
            address: CONTRACTS.QUALITY_ORACLE,
            abi: qualityOracleAbi,
            functionName: 'getStats',
        });

        // Read AgentRegistry count
        const agentCount = await publicClient.readContract({
            address: CONTRACTS.AGENT_REGISTRY,
            abi: agentRegistryAbi,
            functionName: 'getAgentCount',
        });

        return NextResponse.json({
            totalReports: Number(total),
            totalPassed: Number(passed),
            totalFailed: Number(failed),
            passRate: Number(passRate),
            agentCount: Number(agentCount),
            onChain: true,
        });
    } catch (error) {
        console.error('Stats read error:', error);

        // Fallback to defaults
        return NextResponse.json({
            totalReports: 0,
            totalPassed: 0,
            totalFailed: 0,
            passRate: 0,
            agentCount: 1,
            onChain: false,
            error: String(error),
        });
    }
}
