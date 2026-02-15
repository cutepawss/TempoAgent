import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createWalletClient, createPublicClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "fs";

const tempoTestnet = defineChain({
    id: 42431,
    name: "Tempo Testnet",
    nativeCurrency: { name: "USD", symbol: "USD", decimals: 18 },
    rpcUrls: { default: { http: ["https://rpc.moderato.tempo.xyz"] } },
});

const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY);

const publicClient = createPublicClient({
    chain: tempoTestnet,
    transport: http(),
});

const walletClient = createWalletClient({
    account,
    chain: tempoTestnet,
    transport: http(),
});

function loadArtifact(name) {
    const path = `./artifacts/contracts/${name}.sol/${name}.json`;
    const artifact = JSON.parse(readFileSync(path, "utf-8"));
    return { abi: artifact.abi, bytecode: artifact.bytecode };
}

async function deploy(name, args = []) {
    const { abi, bytecode } = loadArtifact(name);
    console.log(`Deploying ${name}...`);

    const hash = await walletClient.deployContract({
        abi,
        bytecode,
        args,
    });

    console.log(`  TX: ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`  Address: ${receipt.contractAddress}`);
    return { address: receipt.contractAddress, abi };
}

async function main() {
    console.log("Deployer:", account.address);
    const balance = await publicClient.getBalance({ address: account.address });
    console.log("Balance:", (Number(balance) / 1e18).toFixed(4), "USD\n");

    // 1. AgentRegistry
    const registry = await deploy("AgentRegistry");

    // 2. QualityOracle (needs registry address)
    const oracle = await deploy("QualityOracle", [registry.address]);

    // 3. EscrowVault (needs registry + oracle)
    const escrow = await deploy("EscrowVault", [registry.address, oracle.address]);

    // 4. Link: AgentRegistry.setQualityOracle(oracle)
    console.log("\nLinking contracts...");
    const linkHash = await walletClient.writeContract({
        address: registry.address,
        abi: registry.abi,
        functionName: "setQualityOracle",
        args: [oracle.address],
    });
    await publicClient.waitForTransactionReceipt({ hash: linkHash });
    console.log("  AgentRegistry → QualityOracle linked");

    // 5. Register demo agent: Translator
    console.log("\nRegistering demo agent...");
    const regHash = await walletClient.writeContract({
        address: registry.address,
        abi: registry.abi,
        functionName: "registerAgent",
        args: ["Translator", 50000n, ["translation", "localization"]], // 0.05 AlphaUSD (6 decimals)
    });
    await publicClient.waitForTransactionReceipt({ hash: regHash });
    console.log("  Registered: Translator (translation, localization)");

    // Summary
    console.log("\n══════════════════════════════════════════");
    console.log("  Deployed on Tempo Testnet (Chain 42431)");
    console.log("══════════════════════════════════════════");
    console.log(`  AgentRegistry:  ${registry.address}`);
    console.log(`  QualityOracle:  ${oracle.address}`);
    console.log(`  EscrowVault:    ${escrow.address}`);
    console.log("══════════════════════════════════════════");
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
