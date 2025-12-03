import path from "path";
import fs from "fs-extra";
import { run } from "hardhat";

export type ContractKey = "primary" | "underlay";

export type DeploymentRecord = {
  contract: ContractKey;
  network: string;
  chainId: number;
  address: string;
  deployer: string;
  txHash?: string;
  blockNumber?: number;
  deployedAt: string;
  primaryAddress?: string;
  verification?: {
    success: boolean;
    message?: string;
  };
};

const DEPLOYMENTS_DIR = path.join(__dirname, "..", "contracts-deployed");

export function deploymentFilePath(
  contract: ContractKey,
  networkName: string,
): string {
  return path.join(DEPLOYMENTS_DIR, `${contract}-${networkName}.json`);
}

export function readDeployment(
  contract: ContractKey,
  networkName: string,
): DeploymentRecord | null {
  const filePath = deploymentFilePath(contract, networkName);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const raw = fs.readFileSync(filePath, "utf8").trim();
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as DeploymentRecord;
  } catch (error) {
    console.warn(`Could not parse ${filePath}: ${(error as Error).message}`);
    return null;
  }
}

export async function writeDeployment(
  contract: ContractKey,
  networkName: string,
  recordData: Omit<DeploymentRecord, "contract" | "network">,
): Promise<DeploymentRecord> {
  const filePath = deploymentFilePath(contract, networkName);
  await fs.ensureDir(DEPLOYMENTS_DIR);

  const payload: DeploymentRecord = {
    contract,
    network: networkName,
    ...recordData,
  };

  await fs.writeJson(filePath, payload, { spaces: 2 });
  console.log(`Saved ${contract} deployment to ${filePath}`);
  return payload;
}

export async function verifyContractIfPossible(options: {
  contractName: string;
  address: string;
  constructorArguments?: unknown[];
  networkName: string;
  explorerHint?: string;
  isBlockscout?: boolean;
}): Promise<{ success: boolean; message?: string }> {
  const {
    contractName,
    address,
    constructorArguments = [],
    networkName,
    explorerHint,
    isBlockscout = false,
  } = options;

  try {
    await run("verify:verify", {
      address,
      constructorArguments,
    });
    console.log(
      `Verified ${contractName} on ${networkName}${explorerHint ? ` (${explorerHint})` : ""}.`,
    );
    return { success: true, message: "Verified" };
  } catch (error) {
    const message = (error as Error).message || String(error);
    const normalized = message.toLowerCase();

    if (normalized.includes("already verified")) {
      console.log(
        `${contractName} is already verified on ${networkName}${explorerHint ? ` (${explorerHint})` : ""}.`,
      );
      return { success: true, message: "Already verified" };
    }

    if (
      normalized.includes("invalid api key") ||
      normalized.includes("missing api key") ||
      normalized.includes("api key not set")
    ) {
      console.warn(
        `Explorer API key is missing for ${networkName}; skipping verification for ${contractName}.`,
      );
      return { success: false, message };
    }

    if (
      normalized.includes("failed to fetch") ||
      normalized.includes("connect econrefused") ||
      normalized.includes("socket hang up")
    ) {
      if (isBlockscout) {
        console.warn(
          `Blockscout for ${networkName} is unreachable${explorerHint ? ` (${explorerHint})` : ""}. Start SuNet with Blockscout (pnpm run sunet:start) and ensure BLOCKSCOUT_PORT in nodejs/smart-contract/sunet/.env.sunet matches the running port.`,
        );
      } else {
        console.warn(
          `Explorer for ${networkName} is unreachable${explorerHint ? ` (${explorerHint})` : ""}. Make sure the explorer is running and the URL is correct.`,
        );
      }
      return { success: false, message };
    }

    console.warn(
      `Verification skipped for ${contractName} on ${networkName}${explorerHint ? ` (${explorerHint})` : ""}: ${message}`,
    );
    return { success: false, message };
  }
}
