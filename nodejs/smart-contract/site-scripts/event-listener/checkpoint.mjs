/**
 * Checkpoint management module.
 * Handles reading the loadedTo.json file.
 *
 * IMPORTANT:
 * - update-assets.mjs writes loadedTo.json as a plain number (e.g. 5825)
 * - older code sometimes wrote an object (e.g. { "blockNumber": 5825 })
 *
 * This loader supports both formats so the listener doesn't fall back to deploymentBlock.
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

  if (!fs.existsSync(checkpointPath)) {
    return 0;
  }

  try {
    const raw = fs.readFileSync(checkpointPath, "utf8");
    const data = JSON.parse(raw);

    // Format A: plain number
    if (typeof data === "number" && Number.isFinite(data)) {
      return data;
    }

    // Format B: object wrapper
    if (data && typeof data === "object") {
      if (typeof data.blockNumber === "number" && Number.isFinite(data.blockNumber)) {
        return data.blockNumber;
      }
      if (typeof data.loadedTo === "number" && Number.isFinite(data.loadedTo)) {
        return data.loadedTo;
      }
    }

    console.warn(chalk.yellow("Warning: Checkpoint file parsed but format was unrecognized; defaulting to 0"));
    return 0;
  } catch (err) {
    console.warn(chalk.yellow(`Warning: Could not read checkpoint file: ${err.message}`));
    return 0;
  }
}
