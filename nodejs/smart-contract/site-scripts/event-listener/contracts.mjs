/**
 * Contract management module.
 * Handles loading deployment info and creating contract instances.
 */
import fs from "fs";
import path from "path";
import chalk from "chalk";
import { ethers } from "ethers";

// ============================================================================
// Contract ABIs
// ============================================================================

export const ABI_PRIMARY = [
  "event Personalized(uint256 squareNumber)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed squareNumber)",
];

export const ABI_UNDERLAY = [
  "event PersonalizedUnderlay(uint256 indexed squareNumber, bytes rgbData, string title, string href)"
];

// ============================================================================
// Deployment Info Loading
// ============================================================================

export function loadDeploymentInfo(network, smartContractRoot) {
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
// Contract Instance Creation
// ============================================================================

export function createContractInstances(provider, deploymentInfo) {
  const primaryContract = new ethers.Contract(
    deploymentInfo.primaryAddress,
    ABI_PRIMARY,
    provider
  );

  const underlayContract = new ethers.Contract(
    deploymentInfo.underlayAddress,
    ABI_UNDERLAY,
    provider
  );

  return {
    primaryContract,
    underlayContract,
  };
}
