import { NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { tempoTestnet } from '@/lib/tempo';
import { CONTRACTS } from '@/lib/constants';
import { agentRegistryAbi } from '@/lib/abis';

/**
 * GET /api/agents/score?address=0x...&skill=translation
 * Reads real on-chain trust score from AgentRegistry
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const address = searchParams.get('address');
        const skill = searchParams.get('skill');

        if (!address || !skill) {
            return NextResponse.json(
                { error: 'Missing address or skill query params' },
                { status: 400 }
            );
        }

        const publicClient = createPublicClient({
            chain: tempoTestnet,
            transport: http(),
        });

        const [score, tier, completed, failed] = await publicClient.readContract({
            address: CONTRACTS.AGENT_REGISTRY,
            abi: agentRegistryAbi,
            functionName: 'getAgentSkillScore',
            args: [address as `0x${string}`, skill],
        });

        const tierNames = ['Bronze', 'Silver', 'Gold', 'Platinum'];

        return NextResponse.json({
            score: Number(score),
            tier: tierNames[Number(tier)] || 'Bronze',
            tasksCompleted: Number(completed),
            tasksFailed: Number(failed),
            onChain: true,
        });
    } catch (error) {
        console.error('Score read error:', error);
        return NextResponse.json({
            score: 500,
            tier: 'Silver',
            tasksCompleted: 0,
            tasksFailed: 0,
            onChain: false,
            error: String(error),
        });
    }
}
