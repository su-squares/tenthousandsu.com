#!/usr/bin/env node
/**
 * Su Squares Event Listener - Main Entry Point
 *
 * Real-time blockchain event listener for Su Squares NFT project.
 * Monitors SuNet and Sepolia networks for NFT events (mints, personalizations)
 * and triggers asset updates via update-assets.mjs.
 *
 * Usage:
 *   NETWORK=sunet node index.mjs
 *   NETWORK=sepolia node index.mjs
 *
 * Or via npm scripts:
 *   pnpm run listen:sunet
 *   pnpm run listen:sepolia
 */
import chalk from "chalk";
import { loadConfig, CONSTANTS } from "./config.mjs";
import { createProvider } from "./provider.mjs";
import { loadDeploymentInfo, createContractInstances } from "./contracts.mjs";
import { loadCheckpoint } from "./checkpoint.mjs";
import { catchUpMissedEvents } from "./catch-up.mjs";
import { EventAccumulator } from "./accumulator.mjs";
import { setupEventListeners } from "./event-handlers.mjs";

// ============================================================================
// Graceful Shutdown
// ============================================================================

function setupGracefulShutdown(provider, accumulator) {
  const cleanup = async () => {
    console.log(chalk.yellow("\n\nShutting down gracefully..."));

    // Stop accumulator monitoring
    accumulator.cleanup();

    // If there are pending events, trigger one final update
    if (accumulator.pendingEvents.size > 0) {
      console.log(chalk.yellow(`Processing ${accumulator.pendingEvents.size} pending events before shutdown...`));
      try {
        // Get all pending token IDs
        const pendingTokens = Array.from(accumulator.pendingEvents.keys());
        await accumulator.triggerUpdate(pendingTokens);
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

  // 1. Load configuration
  const config = loadConfig();

  // 2. Create WebSocket provider with reconnection handling
  let provider;
  let reconnectAttempts = 0;

  const handleProviderError = async (error) => {
    if (reconnectAttempts < config.constants.MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      console.log(chalk.yellow(
        `Attempting reconnection ${reconnectAttempts}/${config.constants.MAX_RECONNECT_ATTEMPTS}...`
      ));

      await new Promise(resolve => setTimeout(resolve, config.constants.RECONNECT_DELAY_MS));

      try {
        provider = await createProvider(config.wsUrl, handleProviderError);
        reconnectAttempts = 0;
        console.log(chalk.green("✓ Reconnected successfully"));

        // Re-setup event listeners
        const deploymentInfo = loadDeploymentInfo(config.network, config.smartContractRoot);
        const contracts = createContractInstances(provider, deploymentInfo);
        setupEventListeners(
          contracts.primaryContract,
          contracts.underlayContract,
          deploymentInfo.primaryAddress,
          accumulator
        );
      } catch (err) {
        console.error(chalk.red(`Reconnection failed: ${err.message}`));
      }
    } else {
      console.error(chalk.red("Max reconnection attempts reached. Exiting."));
      process.exit(1);
    }
  };

  try {
    provider = await createProvider(config.wsUrl, handleProviderError);
  } catch (err) {
    console.error(chalk.red(`Failed to initialize provider: ${err.message}`));
    process.exit(1);
  }

  // 3. Load deployment information
  const deploymentInfo = loadDeploymentInfo(config.network, config.smartContractRoot);

  // 4. Create contract instances
  const contracts = createContractInstances(provider, deploymentInfo);

  // 5. Initialize event accumulator
  const accumulator = new EventAccumulator(
    config.network,
    provider,
    config.smartContractRoot,
    config.constants
  );

  // 6. Perform checkpoint recovery
  try {
    const currentBlock = await provider.getBlockNumber();
    const lastProcessed = loadCheckpoint(config.network, config.repoRoot) || deploymentInfo.deploymentBlock;
    const settledBlock = currentBlock - config.constants.SETTLE_BLOCKS;

    console.log(chalk.cyan(`Current block: ${currentBlock}`));
    console.log(chalk.cyan(`Last processed: ${lastProcessed}`));
    console.log(chalk.cyan(`Settled block: ${settledBlock}`));

    if (lastProcessed < settledBlock) {
      const affectedTokens = await catchUpMissedEvents(
        provider,
        {
          primaryContract: contracts.primaryContract,
          underlayContract: contracts.underlayContract,
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
  setupEventListeners(
    contracts.primaryContract,
    contracts.underlayContract,
    deploymentInfo.primaryAddress,
    accumulator
  );

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
