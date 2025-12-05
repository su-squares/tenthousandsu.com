/**
 * Configuration module for event listener.
 * Handles environment validation, constants, and path resolution.
 */
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import chalk from "chalk";
import { SETTLE_BLOCKS } from "../update-assets/contracts.mjs";

// ============================================================================
// Constants
// ============================================================================

export const CONSTANTS = {
  DEBOUNCE_MS: 10000, // 10 seconds
  SETTLE_BLOCKS, // Imported from shared source in update-assets/contracts.mjs
  MAX_RECONNECT_ATTEMPTS: 5,
  RECONNECT_DELAY_MS: 5000,
  BLOCK_CHECK_INTERVAL_MS: 5000, // Check for confirmations every 5 seconds
};

// ============================================================================
// Helper Functions
// ============================================================================

function normalizeNetwork(raw) {
  const value = (raw || "").toString().toLowerCase();
  if (["mainnet", "sepolia", "sunet"].includes(value)) return value;
  return null;
}

function resolvePathsFromModuleUrl(moduleUrl) {
  const __dirname = path.dirname(fileURLToPath(moduleUrl));
  const repoRoot = path.resolve(__dirname, "..", "..", "..", "..");
  const smartContractRoot = path.join(repoRoot, "nodejs", "smart-contract");
  return { repoRoot, smartContractRoot };
}

// ============================================================================
// Main Configuration Function
// ============================================================================

export function loadConfig(moduleUrl = import.meta.url) {
  // Resolve paths
  const { repoRoot, smartContractRoot } = resolvePathsFromModuleUrl(moduleUrl);

  // Validate network
  const network = normalizeNetwork(process.env.NETWORK);

  if (!network) {
    console.error(chalk.red("ERROR: NETWORK environment variable must be set to 'sepolia' or 'sunet'"));
    console.log(chalk.yellow("\nUsage:"));
    console.log("  pnpm run listen:sepolia");
    console.log("  pnpm run listen:sunet");
    process.exit(1);
  }

  // Load environment files
  dotenv.config({ path: path.join(repoRoot, "nodejs", ".env.site") });
  dotenv.config({ path: path.join(smartContractRoot, ".env.contract") });

  if (network === "sunet") {
    dotenv.config({ path: path.join(smartContractRoot, "sunet", ".env.sunet") });
  }

  // Determine WebSocket URL
  let wsUrl;
  if (network === "sunet") {
    const wsPort = process.env.RPC_WS_PORT || "8546";
    wsUrl = `ws://127.0.0.1:${wsPort}`;
  } else if (network === "sepolia") {
    wsUrl = process.env.SEPOLIA_WS_URL;
    if (!wsUrl) {
      console.error(chalk.red("ERROR: SEPOLIA_WS_URL not set in .env.contract"));
      console.log(chalk.yellow("\nAdd to nodejs/smart-contract/.env.contract:"));
      console.log("  SEPOLIA_WS_URL=wss://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY");
      console.log("  OR");
      console.log("  SEPOLIA_WS_URL=wss://sepolia.infura.io/ws/v3/YOUR_PROJECT_ID");
      process.exit(1);
    }
  }

  // Log configuration
  console.log(chalk.cyan(`Network: ${network}`));
  console.log(chalk.cyan(`WebSocket URL: ${wsUrl}`));

  return {
    network,
    wsUrl,
    repoRoot,
    smartContractRoot,
    constants: CONSTANTS,
  };
}