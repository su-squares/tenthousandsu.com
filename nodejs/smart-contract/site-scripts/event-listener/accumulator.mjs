/**
 * Event accumulator module with block monitoring.
 * Tracks events with their block numbers and waits for confirmations before triggering updates.
 *
 * KEY FIX: Instead of blindly triggering updates, this now:
 * 1. Tracks block numbers for each event
 * 2. Polls the blockchain to check when events are confirmed
 * 3. Only triggers updates when events have sufficient confirmations
 * 4. Shows confirmation countdown and queue status
 */
import { spawn } from "child_process";
import path from "path";
import chalk from "chalk";

// ============================================================================
// EventAccumulator Class
// ============================================================================

export class EventAccumulator {
  constructor(network, provider, smartContractRoot, constants) {
    this.network = network;
    this.provider = provider;
    this.smartContractRoot = smartContractRoot;
    this.constants = constants;
    this.pendingEvents = new Map(); // tokenId -> blockNumber
    this.isProcessing = false;
    this.blockMonitor = null;
  }

  // ============================================================================
  // Add Event (with block number tracking)
  // ============================================================================

  addEvent(tokenId, blockNumber) {
    // Track highest block for each token (in case of multiple events for same token)
    const existing = this.pendingEvents.get(tokenId);
    if (!existing || blockNumber > existing) {
      this.pendingEvents.set(tokenId, blockNumber);
    }

    // Log queue status
    this.logQueueStatus();

    // Start block monitoring if not already running
    this.startBlockMonitoring();
  }

  // ============================================================================
  // Block Monitoring (polls every 5 seconds)
  // ============================================================================

  startBlockMonitoring() {
    if (this.blockMonitor) return; // Already running

    this.blockMonitor = setInterval(async () => {
      await this.checkAndTriggerUpdates();
    }, this.constants.BLOCK_CHECK_INTERVAL_MS);
  }

  async checkAndTriggerUpdates() {
    if (this.isProcessing || this.pendingEvents.size === 0) {
      return;
    }

    try {
      const currentBlock = await this.provider.getBlockNumber();
      const settledBlock = currentBlock - this.constants.SETTLE_BLOCKS;

      // Find events that are now settled
      const settledTokens = [];
      let highestEventBlock = 0;

      for (const [tokenId, blockNumber] of this.pendingEvents.entries()) {
        if (blockNumber > highestEventBlock) {
          highestEventBlock = blockNumber;
        }

        if (blockNumber <= settledBlock) {
          settledTokens.push(tokenId);
        }
      }

      if (settledTokens.length > 0) {
        // Trigger update for settled events
        await this.triggerUpdate(settledTokens);
      } else if (highestEventBlock > 0) {
        // Show confirmation progress
        const confirmationsNeeded = highestEventBlock - settledBlock;
        console.log(chalk.yellow(
          `⏳ Waiting for ${confirmationsNeeded} more confirmation(s)... ` +
          `(${this.pendingEvents.size} event(s) queued)`
        ));
      }
    } catch (err) {
      console.error(chalk.red(`Error checking confirmations: ${err.message}`));
    }
  }

  // ============================================================================
  // Trigger Update (when events are confirmed)
  // ============================================================================

  async triggerUpdate(settledTokenIds) {
    this.isProcessing = true;

    // Remove these tokens from pending
    for (const tokenId of settledTokenIds) {
      this.pendingEvents.delete(tokenId);
    }

    console.log(chalk.yellow(`\n${"=".repeat(60)}`));
    console.log(chalk.yellow(`Generating assets for ${settledTokenIds.length} confirmed event(s)...`));
    console.log(chalk.yellow("=".repeat(60)));

    try {
      await this.runUpdateAssets();

      // Stop monitoring if queue is empty
      if (this.pendingEvents.size === 0 && this.blockMonitor) {
        clearInterval(this.blockMonitor);
        this.blockMonitor = null;
      }
    } catch (err) {
      console.error(chalk.red(`Update failed: ${err.message}`));
    } finally {
      this.isProcessing = false;
    }
  }

  // ============================================================================
  // Run update-assets.mjs Script
  // ============================================================================

  async runUpdateAssets() {
    return new Promise((resolve, reject) => {
      const updateScript = path.join(this.smartContractRoot, "site-scripts", "update-assets.mjs");
      const args = [`--network=${this.network}`];

      const child = spawn("node", [updateScript, ...args], {
        stdio: "inherit",
        cwd: this.smartContractRoot,
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

  // ============================================================================
  // Queue Status Logging
  // ============================================================================

  logQueueStatus() {
    console.log(chalk.cyan(
      `📋 Queue: ${this.pendingEvents.size} event(s) pending confirmation`
    ));

    // Show each pending event with its block
    for (const [tokenId, blockNumber] of this.pendingEvents.entries()) {
      console.log(chalk.gray(`   └─ Square ${tokenId} at block ${blockNumber}`));
    }
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  cleanup() {
    if (this.blockMonitor) {
      clearInterval(this.blockMonitor);
      this.blockMonitor = null;
    }
  }
}
