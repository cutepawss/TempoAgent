import { NextResponse } from 'next/server';
import {
    createWalletClient,
    createPublicClient,
    http,
    keccak256,
    toHex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { tempoTestnet } from '@/lib/tempo';
import { CONTRACTS } from '@/lib/constants';
import { qualityOracleAbi, agentRegistryAbi } from '@/lib/abis';

/**
 * POST /api/verify
 * Submits a quality report to QualityOracle on-chain
 * 
 * Body: { taskId, agentAddress, skill, confidence, pass, reason }
 * Returns: { txHash, verdict, scoreDelta, newScore?, mock }
 */
export async function POST(request: Request) {
    let taskId: string | undefined;
    let agentAddress: string | undefined;

    try {
        const body = await request.json();
        taskId = body.taskId;
        agentAddress = body.agentAddress;
        const { skill, confidence, pass, reason } = body;

        if (!taskId || !agentAddress || !skill || confidence === undefined) {
            return NextResponse.json(
                { error: 'Missing required fields: taskId, agentAddress, skill, confidence' },
                { status: 400 }
            );
        }

        const privateKey = process.env.AGENT_PRIVATE_KEY as `0x${string}` | undefined;

        // Convert taskId string to bytes32
        const taskIdBytes32 = keccak256(toHex(taskId));
        const verdict = pass ? 0 : 1; // 0=Pass, 1=Fail, 2=Hallucination
        const scoreDelta = pass ? 2 : -10;

        // If no private key → mock
        if (!privateKey) {
            return NextResponse.json({
                txHash: `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
                taskIdBytes32,
                verdict: pass ? 'Pass' : 'Fail',
                scoreDelta,
                mock: true,
            });
        }

        // ── Real on-chain call ──
        const account = privateKeyToAccount(privateKey);

        const publicClient = createPublicClient({
            chain: tempoTestnet,
            transport: http(),
        });

        const walletClient = createWalletClient({
            account,
            chain: tempoTestnet,
            transport: http(),
        });

        // Submit quality report to QualityOracle
        const hash = await walletClient.writeContract({
            address: CONTRACTS.QUALITY_ORACLE,
            abi: qualityOracleAbi,
            functionName: 'submitReport',
            args: [
                taskIdBytes32,
                agentAddress as `0x${string}`,
                skill,
                confidence,
                verdict,
                reason || (pass ? 'Quality verified' : 'Below threshold'),
            ],
        });

        // Wait for confirmation
        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        // Read updated score from AgentRegistry
        let newScore: bigint | undefined;
        try {
            const result = await publicClient.readContract({
                address: CONTRACTS.AGENT_REGISTRY,
                abi: agentRegistryAbi,
                functionName: 'getAgentSkillScore',
                args: [agentAddress as `0x${string}`, skill],
            });
            newScore = result[0]; // score
        } catch {
            // Score read failed — not critical
        }

        return NextResponse.json({
            txHash: hash,
            taskIdBytes32,
            verdict: pass ? 'Pass' : 'Fail',
            scoreDelta,
            newScore: newScore ? Number(newScore) : undefined,
            blockNumber: receipt.blockNumber.toString(),
            mock: false,
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;

        console.error('❌ VERIFY ERROR - Transaction failed, falling back to mock:');
        console.error('Error message:', errorMessage);
        console.error('Error stack:', errorStack);
        console.error('Task ID:', taskId);
        console.error('Agent:', agentAddress);
        console.error('Private key exists:', !!process.env.AGENT_PRIVATE_KEY);

        // Fallback to mock on error
        return NextResponse.json({
            txHash: `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
            verdict: 'Pass',
            scoreDelta: 2,
            mock: true,
            error: errorMessage,
        });
    }
}
