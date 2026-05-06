import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";
import * as path from "path";

// Load from the ARIA monorepo root — one shared .env for all sub-projects
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "";
const accounts = PRIVATE_KEY ? [PRIVATE_KEY] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: false,
    },
  },

  networks: {
    // Local development
    hardhat: {},

    // Mantle Testnet (Sepolia) — chain ID 5003
    mantleTestnet: {
      url: process.env.MANTLE_TESTNET_RPC ?? "https://rpc.sepolia.mantle.xyz",
      accounts,
      chainId: 5003,
      timeout: 120000,       // 2 min — Mantle testnet RPC can be slow
    },

    // Mantle Mainnet — chain ID 5000
    mantleMainnet: {
      url: process.env.MANTLE_MAINNET_RPC ?? "https://rpc.mantle.xyz",
      accounts,
      chainId: 5000,
    },
  },

  etherscan: {
    apiKey: {
      mantleTestnet: process.env.MANTLE_EXPLORER_API_KEY ?? "no-api-key",
      mantleMainnet: process.env.MANTLE_EXPLORER_API_KEY ?? "no-api-key",
    },
    customChains: [
      {
        network: "mantleTestnet",
        chainId: 5003,
        urls: {
          apiURL: "https://explorer.sepolia.mantle.xyz/api",
          browserURL: "https://explorer.sepolia.mantle.xyz",
        },
      },
      {
        network: "mantleMainnet",
        chainId: 5000,
        urls: {
          apiURL: "https://explorer.mantle.xyz/api",
          browserURL: "https://explorer.mantle.xyz",
        },
      },
    ],
  },

  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
  },

  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
