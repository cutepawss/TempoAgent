import "dotenv/config";

/** @type import('hardhat/config').HardhatUserConfig */
export default {
    solidity: {
        version: "0.8.20",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    networks: {
        tempoTestnet: {
            type: "http",
            url: "https://rpc.moderato.tempo.xyz",
            chainId: 42431,
            accounts: process.env.AGENT_PRIVATE_KEY
                ? [process.env.AGENT_PRIVATE_KEY]
                : [],
        },
    },
};
