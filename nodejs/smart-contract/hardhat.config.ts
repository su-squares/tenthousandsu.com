import path from "path";
import * as dotenv from "dotenv";
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import "hardhat-gas-reporter";

import { loadSunetEnv } from "./scripts/helpers/env";

dotenv.config({ path: path.join(__dirname, ".env") });

const argv = process.argv.slice(2);
const requestedNetwork =
  process.env.HARDHAT_NETWORK ||
  (() => {
    const idx = argv.findIndex((arg) => arg === "--network" || arg === "-n");
    return idx !== -1 ? argv[idx + 1] : undefined;
  })();
const requestedNetworkLower = (requestedNetwork || "").toLowerCase();
const wantsSunet = (process.env.HARDHAT_NETWORK || "").toLowerCase() === "sunet";
const sunetEnv = loadSunetEnv({ required: wantsSunet }) ?? loadSunetEnv();

const blockscoutBrowserUrl = sunetEnv?.blockscoutBrowserUrl ?? "http://127.0.0.1:4001";
const blockscoutApiUrl = sunetEnv?.blockscoutApiUrl ?? "http://127.0.0.1:4001/api";

if (requestedNetworkLower === "sepolia") {
  if (!process.env.SEPOLIA_RPC_URL) {
    console.warn("SEPOLIA_RPC_URL is not set. Sepolia deployments will fail until it is provided.");
  }
  if (!process.env.SEPOLIA_PRIVATE_KEY) {
    console.warn("SEPOLIA_PRIVATE_KEY is not set. Add it to nodejs/smart-contract/.env before deploying to Sepolia.");
  }
}

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.4.24",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.9",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {},
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: process.env.SEPOLIA_PRIVATE_KEY ? [process.env.SEPOLIA_PRIVATE_KEY] : [],
    },
    sunet: {
      url: sunetEnv?.rpcUrl ?? "http://127.0.0.1:8545",
      chainId: sunetEnv?.LOCAL_CHAIN_ID ?? 1337,
      accounts: sunetEnv?.VALIDATOR_PRIVATE_KEY ? [sunetEnv.VALIDATOR_PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_API_KEY || "",
      sunet: sunetEnv?.BLOCKSCOUT_API_KEY || "blockscout-api-key",
    },
    customChains: [
      {
        network: "sunet",
        chainId: sunetEnv?.LOCAL_CHAIN_ID ?? 1337,
        urls: {
          apiURL: blockscoutApiUrl,
          browserURL: blockscoutBrowserUrl,
        },
      },
    ],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    showMethodSig: true,
    noColors: true,
  },
};

export default config;
