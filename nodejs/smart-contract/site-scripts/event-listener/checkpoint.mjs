/**
 * Checkpoint management module.
 * Handles reading/writing the loadedTo.json file.
 */
import fs from "fs";
import path from "path";
import chalk from "chalk";

// ============================================================================
// Path Helpers
// ============================================================================

export function getBuildDir(network, repoRoot) {
  return path.join(repoRoot, network === "mainnet" ? "build" : `build-${network}`);
}

// ============================================================================
// Checkpoint Loading
// ============================================================================

export function loadCheckpoint(network, repoRoot) {
  const buildDir = getBuildDir(network, repoRoot);
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
