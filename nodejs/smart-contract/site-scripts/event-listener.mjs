#!/usr/bin/env node
/**
 * Real-time blockchain event listener for Su Squares.
 * Monitors SuNet and Sepolia networks for NFT events (mints, personalizations)
 * and triggers asset updates via update-assets.mjs.
 *
 * Usage:
 *   NETWORK=sunet node event-listener.mjs
 *   NETWORK=sepolia node event-listener.mjs
 *
 * Or via npm scripts:
 *   pnpm run listen:sunet
 *   pnpm run listen:sepolia
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import dotenv from "dotenv";
import chalk from "chalk";
import { ethers } from "ethers";

// ============================================================================
// Constants
// ============================================================================

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..", "..");
const smartContractRoot = path.join(repoRoot, "nodejs", "smart-contract");

const DEBOUNCE_MS = 10000; // 10 seconds
const SETTLE_BLOCKS = 10; // Wait for 10 block confirmations
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 5000;

// Contract ABIs (minimal - just the events we need)
const ABI_PRIMARY = [
  "event Personalized(uint256 squareNumber)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed squareNumber)",
];

const ABI_UNDERLAY = [
  "event PersonalizedUnderlay(uint256 indexed squareNumber, bytes rgbData, string title, string href)"
];

// ============================================================================
// Environment & Configuration Loading
// ============================================================================

function normalizeNetwork(raw) {
  const value = (raw || "").toString().toLowerCase();
  if (["mainnet", "sepolia", "sunet"].includes(value)) return value;
  return null;
}

function validateAndLoadEnv() {
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

  console.log(chalk.cyan(`Network: ${network}`));
  console.log(chalk.cyan(`WebSocket URL: ${wsUrl}`));

  return { network, wsUrl };
}

function loadDeploymentInfo(network) {
  const primaryPath = path.join(smartContractRoot, "contracts-deployed", `primary-${network}.json`);
  const underlayPath = path.join(smartContractRoot, "contracts-deployed", `underlay-${network}.json`);

  if (!fs.existsSync(primaryPath)) {
    console.error(chalk.red(`ERROR: Primary contract deployment file not found: ${primaryPath}`));
    console.log(chalk.yellow(`\nDeploy contracts first with: pnpm run deploy:${network}:all`));
    process.exit(1);
  }

  if (!fs.existsSync(underlayPath)) {
    console.error(chalk.red(`ERROR: Underlay contract deployment file not found: ${underlayPath}`));
    console.log(chalk.yellow(`\nDeploy contracts first with: pnpm run deploy:${network}:all`));
    process.exit(1);
  }

  const primaryData = JSON.parse(fs.readFileSync(primaryPath, "utf8"));
  const underlayData = JSON.parse(fs.readFileSync(underlayPath, "utf8"));

  if (!primaryData.address || !underlayData.address) {
    console.error(chalk.red("ERROR: Deployment files are incomplete (missing addresses)"));
    process.exit(1);
  }

  console.log(chalk.cyan(`Primary contract: ${primaryData.address}`));
  console.log(chalk.cyan(`Underlay contract: ${underlayData.address}`));

  return {
    primaryAddress: primaryData.address,
    underlayAddress: underlayData.address,
    deploymentBlock: primaryData.blockNumber || 0,
  };
}

// ============================================================================
// Checkpoint System
// ============================================================================

function getBuildDir(network) {
  return path.join(repoRoot, network === "mainnet" ? "build" : `build-${network}`);
}

function loadCheckpoint(network) {
  const buildDir = getBuildDir(network);
  const checkpointPath = path.join(buildDir, "loadedTo.json");

  if (fs.existsSync(checkpointPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
      return data.blockNumber || 0;
    } catch (err) {
      console.warn(chalk.yellow(`Warning: Could not read checkpoint file: ${err.message}`));
      return 0;
    }
  }

  return 0;
}

// ============================================================================
// Historical Event Catch-up
// ============================================================================

async function catchUpMissedEvents(provider, contracts, fromBlock, toBlock) {
  const { primaryContract, underlayContract, primaryAddress } = contracts;

  console.log(chalk.yellow(`\nCatching up on events from block ${fromBlock} to ${toBlock}...`));

  const affectedTokens = new Set();

  try {
    // Query Transfer events (sales from contract)
    const transferFilter = primaryContract.filters.Transfer(primaryAddress, null, null);
    const transfers = await primaryContract.queryFilter(transferFilter, fromBlock, toBlock);

    for (const event of transfers) {
      const tokenId = Number(event.args.squareNumber);
      affectedTokens.add(tokenId);
      console.log(chalk.blue(`  [Catchup] Transfer: Square ${tokenId} at block ${event.blockNumber}`));
    }

    // Query PersonalizedUnderlay events
    const underlayFilter = underlayContract.filters.PersonalizedUnderlay();
    const underlayEvents = await underlayContract.queryFilter(underlayFilter, fromBlock, toBlock);

    for (const event of underlayEvents) {
      const tokenId = Number(event.args.squareNumber);
      affectedTokens.add(tokenId);
      console.log(chalk.magenta(`  [Catchup] Underlay: Square ${tokenId} at block ${event.blockNumber}`));
    }

    // Query Personalized events
    const personalizedFilter = primaryContract.filters.Personalized();
    const personalizedEvents = await primaryContract.queryFilter(personalizedFilter, fromBlock, toBlock);

    for (const event of personalizedEvents) {
      const tokenId = Number(event.args.squareNumber);
      affectedTokens.add(tokenId);
      console.log(chalk.green(`  [Catchup] Personalized: Square ${tokenId} at block ${event.blockNumber}`));
    }

    if (affectedTokens.size > 0) {
      console.log(chalk.yellow(`Found ${affectedTokens.size} affected tokens. Running update...`));
    } else {
      console.log(chalk.green("No missed events found. Up to date!"));
    }

    return affectedTokens;
  } catch (err) {
    console.error(chalk.red(`Error during catch-up: ${err.message}`));
    throw err;
  }
}

// ============================================================================
// Event Accumulator (Debouncing)
// ============================================================================

class EventAccumulator {
  constructor(network, debounceMs = DEBOUNCE_MS) {
    this.network = network;
    this.debounceMs = debounceMs;
    this.pendingTokens = new Set();
    this.debounceTimer = null;
    this.isProcessing = false;
  }

  addEvent(tokenId) {
    this.pendingTokens.add(tokenId);
    this.resetDebounceTimer();
  }

  resetDebounceTimer() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.triggerUpdate();
    }, this.debounceMs);
  }

  async triggerUpdate() {
    if (this.isProcessing || this.pendingTokens.size === 0) {
      return;
    }

    this.isProcessing = true;
    const tokenCount = this.pendingTokens.size;
    this.pendingTokens.clear();

    console.log(chalk.yellow(`\n${"=".repeat(60)}`));
    console.log(chalk.yellow(`Triggering asset update for ${tokenCount} token(s)...`));
    console.log(chalk.yellow("=".repeat(60)));

    try {
      await this.runUpdateAssets();
    } catch (err) {
      console.error(chalk.red(`Update failed: ${err.message}`));
    } finally {
      this.isProcessing = false;

      // Check if new events arrived during processing
      if (this.pendingTokens.size > 0) {
        console.log(chalk.yellow(`New events arrived during update. Scheduling next update...`));
        this.resetDebounceTimer();
      }
    }
  }

  async runUpdateAssets() {
    return new Promise((resolve, reject) => {
      const updateScript = path.join(smartContractRoot, "site-scripts", "update-assets.mjs");
      const args = [`--network=${this.network}`];

      const child = spawn("node", [updateScript, ...args], {
        stdio: "inherit",
        cwd: smartContractRoot,
      });

      child.on("exit", (code) => {
        if (code === 0) {
          console.log(chalk.green(`\n✓ Asset update completed successfully\n`));
          resolve();
        } else {
          const error = new Error(`Update process exited with code ${code}`);
          reject(error);
        }
      });

      child.on("error", (err) => {
        console.error(chalk.red(`Failed to spawn update process: ${err.message}`));
        reject(err);
      });
    });
  }

  cleanup() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}

// ============================================================================
// Real-time Event Listeners
// ============================================================================

function setupEventListeners(primaryContract, underlayContract, primaryAddress, accumulator) {
  // Transfer events (only sales from contract)
  primaryContract.on("Transfer", (from, to, tokenId, event) => {
    if (from.toLowerCase() === primaryAddress.toLowerCase()) {
      console.log(chalk.blue(`[Event] Transfer: Square ${tokenId} sold at block ${event.blockNumber}`));
      accumulator.addEvent(Number(tokenId));
    }
  });

  // Personalized events (primary contract)
  primaryContract.on("Personalized", (squareNumber, event) => {
    console.log(chalk.green(`[Event] Personalized: Square ${squareNumber} at block ${event.blockNumber}`));
    accumulator.addEvent(Number(squareNumber));
  });

  // PersonalizedUnderlay events
  underlayContract.on("PersonalizedUnderlay", (squareNumber, rgbData, title, href, event) => {
    console.log(chalk.magenta(`[Event] Underlay: Square ${squareNumber} at block ${event.blockNumber}`));
    accumulator.addEvent(Number(squareNumber));
  });

  console.log(chalk.cyan("✓ Event listeners active"));
}

// ============================================================================
// WebSocket Provider with Reconnection
// ============================================================================

async function createProvider(wsUrl, onError) {
  const provider = new ethers.WebSocketProvider(wsUrl);

  provider.on("error", (error) => {
    console.error(chalk.red(`WebSocket error: ${error.message}`));
    if (onError) {
      onError(error);
    }
  });

  // Test connection
  try {
    await provider.getBlockNumber();
    console.log(chalk.green("✓ Connected to blockchain"));
  } catch (err) {
    console.error(chalk.red(`Failed to connect to WebSocket: ${err.message}`));
    throw err;
  }

  return provider;
}

// ============================================================================
// Graceful Shutdown
// ============================================================================

function setupGracefulShutdown(provider, accumulator) {
  const cleanup = async () => {
    console.log(chalk.yellow("\n\nShutting down gracefully..."));

    // Stop accumulator timer
    accumulator.cleanup();

    // If there are pending events, trigger one final update
    if (accumulator.pendingTokens.size > 0) {
      console.log(chalk.yellow(`Processing ${accumulator.pendingTokens.size} pending events before shutdown...`));
      try {
        await accumulator.triggerUpdate();
      } catch (err) {
        console.error(chalk.red(`Final update failed: ${err.message}`));
      }
    }

    // Destroy WebSocket provider
    if (provider && provider.destroy) {
      await provider.destroy();
    }

    console.log(chalk.green("✓ Shutdown complete"));
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

// ============================================================================
// Main Function
// ============================================================================

async function main() {
  console.log(chalk.bold.cyan("\n" + "=".repeat(60)));
  console.log(chalk.bold.cyan("   Su Squares Event Listener"));
  console.log(chalk.bold.cyan("=".repeat(60) + "\n"));

  // 1. Validate environment and load configuration
  const { network, wsUrl } = validateAndLoadEnv();

  // 2. Load deployment information
  const deploymentInfo = loadDeploymentInfo(network);

  // 3. Create WebSocket provider
  let provider;
  let reconnectAttempts = 0;

  const handleProviderError = async (error) => {
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      console.log(chalk.yellow(`Attempting reconnection ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}...`));

      await new Promise(resolve => setTimeout(resolve, RECONNECT_DELAY_MS));

      try {
        provider = await createProvider(wsUrl);
        reconnectAttempts = 0;
        console.log(chalk.green("✓ Reconnected successfully"));

        // Re-setup event listeners
        const primaryContract = new ethers.Contract(deploymentInfo.primaryAddress, ABI_PRIMARY, provider);
        const underlayContract = new ethers.Contract(deploymentInfo.underlayAddress, ABI_UNDERLAY, provider);
        setupEventListeners(primaryContract, underlayContract, deploymentInfo.primaryAddress, accumulator);
      } catch (err) {
        console.error(chalk.red(`Reconnection failed: ${err.message}`));
      }
    } else {
      console.error(chalk.red("Max reconnection attempts reached. Exiting."));
      process.exit(1);
    }
  };

  try {
    provider = await createProvider(wsUrl, handleProviderError);
  } catch (err) {
    console.error(chalk.red(`Failed to initialize provider: ${err.message}`));
    process.exit(1);
  }

  // 4. Create contract instances
  const primaryContract = new ethers.Contract(deploymentInfo.primaryAddress, ABI_PRIMARY, provider);
  const underlayContract = new ethers.Contract(deploymentInfo.underlayAddress, ABI_UNDERLAY, provider);

  // 5. Initialize event accumulator
  const accumulator = new EventAccumulator(network);

  // 6. Perform checkpoint recovery
  try {
    const currentBlock = await provider.getBlockNumber();
    const lastProcessed = loadCheckpoint(network) || deploymentInfo.deploymentBlock;
    const settledBlock = currentBlock - SETTLE_BLOCKS;

    console.log(chalk.cyan(`Current block: ${currentBlock}`));
    console.log(chalk.cyan(`Last processed: ${lastProcessed}`));
    console.log(chalk.cyan(`Settled block: ${settledBlock}`));

    if (lastProcessed < settledBlock) {
      const affectedTokens = await catchUpMissedEvents(
        provider,
        {
          primaryContract,
          underlayContract,
          primaryAddress: deploymentInfo.primaryAddress,
        },
        lastProcessed + 1,
        settledBlock
      );

      if (affectedTokens.size > 0) {
        console.log(chalk.yellow("\nRunning initial asset update for missed events..."));
        await accumulator.runUpdateAssets();
      }
    } else {
      console.log(chalk.green("✓ No catch-up needed. Already up to date!"));
    }
  } catch (err) {
    console.error(chalk.red(`Checkpoint recovery failed: ${err.message}`));
    console.log(chalk.yellow("Continuing with real-time listening..."));
  }

  // 7. Setup real-time event listeners
  console.log(chalk.cyan("\nSetting up real-time event listeners..."));
  setupEventListeners(primaryContract, underlayContract, deploymentInfo.primaryAddress, accumulator);

  // 8. Setup graceful shutdown
  setupGracefulShutdown(provider, accumulator);

  // 9. Keep process alive
  console.log(chalk.bold.green("\n✓ Listening for events..."));
  console.log(chalk.gray(`Press Ctrl+C to stop\n`));
}

// ============================================================================
// Entry Point
// ============================================================================

main().catch((err) => {
  console.error(chalk.red(`Fatal error: ${err.message}`));
  console.error(err.stack);
  process.exit(1);
});
