import { NextResponse } from 'next/server';
import {
    createWalletClient,
    createPublicClient,
    http,
    parseUnits,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { tempoTestnet, tip20Abi } from '@/lib/tempo';
import { TOKENS } from '@/lib/constants';
import { generateMemo } from '@/lib/agents';

// Agent payment receiver (testnet wallet 2)
const RECEIVER =
    (process.env.AGENT_RECEIVER_ADDRESS as `0x${string}`) ||
    '0xAcF8dBD0352a9D47135DA146EA5DbEfAD58340C4';

function randomHex(len: number): string {
    return Array.from({ length: len }, () =>
        Math.floor(Math.random() * 16).toString(16)
    ).join('');
}

export async function POST(request: Request) {
    try {
        const { taskId, amount } = await request.json();

        if (!taskId || amount === undefined) {
            return NextResponse.json(
                { error: 'Missing taskId or amount' },
                { status: 400 }
            );
        }

        const privateKey = process.env.AGENT_PRIVATE_KEY as `0x${string}` | undefined;
        const memo = generateMemo(taskId);

        // If no private key → mock settlement
        if (!privateKey) {
            return NextResponse.json({
                txHash: `0x${randomHex(64)}`,
                memo,
                mock: true,
            });
        }

        // ---- Real Tempo settlement ----
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

        // Read token decimals (Tempo stablecoins typically use 6 decimals)
        let decimals = 6;
        try {
            decimals = await publicClient.readContract({
                address: TOKENS.ALPHA_USD,
                abi: tip20Abi,
                functionName: 'decimals',
            });
        } catch {
            // Default to 6 for Tempo stablecoins
        }

        const amountInWei = parseUnits(amount.toString(), decimals);

        // TEMPORARY: Test with 2-arg transfer (no memo) to diagnose revert issue
        // Send TIP-20 transfer WITHOUT MEMO to test if memo is causing the revert
        const hash = await walletClient.writeContract({
            address: TOKENS.ALPHA_USD,
            abi: tip20Abi,
            functionName: 'transfer',
            args: [RECEIVER, amountInWei], // 2-arg version
        });

        // Original 3-arg version (currently disabled for testing):
        // const hash = await walletClient.writeContract({
        //     address: TOKENS.ALPHA_USD,
        //     abi: tip20Abi,
        //     functionName: 'transfer',
        //     args: [RECEIVER, amountInWei, memo],
        // });

        // Wait for confirmation (sub-second on Tempo)
        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        return NextResponse.json({
            txHash: hash,
            memo,
            mock: false,
            blockNumber: receipt.blockNumber.toString(),
            status: receipt.status,
        });
    } catch (error) {
        console.error('Settlement error:', error);

        // Fallback to mock on any error
        let taskId = 'unknown';
        try {
            const body = await request.clone().json();
            taskId = body.taskId || 'unknown';
        } catch {
            // ignore parse error
        }

        return NextResponse.json({
            txHash: `0x${randomHex(64)}`,
            memo: generateMemo(taskId),
            mock: true,
            error: String(error),
        });
    }
}
