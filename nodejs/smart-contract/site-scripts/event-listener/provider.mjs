/**
 * WebSocket provider module.
 * Handles creating and managing WebSocket connections to the blockchain.
 */
import chalk from "chalk";
import { ethers } from "ethers";

// ============================================================================
// Provider Creation
// ============================================================================

export async function createProvider(wsUrl, onError) {
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
