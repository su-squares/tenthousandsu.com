import chalk from "chalk";
import { ethers, network } from "hardhat";

import { readDeployment } from "@script-utils/deployments";
import { ContractEnv, loadContractEnv } from "@script-utils/env";
import { ensureNetworkIsReachable, ensureSunetReady } from "@script-utils/network";

async function ensureNetworkReady(networkName: string): Promise<void> {
  if (networkName === "sunet") {
    await ensureSunetReady();
  } else {
    await ensureNetworkIsReachable(networkName);
  }
}

async function getReadyState(): Promise<{
  env: ContractEnv;
  networkName: string;
  contractAddress: string;
}> {
  const env = loadContractEnv({ required: true, requireKeys: ["COO_ADDRESS"] });
  if (!env) {
    throw new Error("Contract env missing required addresses.");
  }

  const networkName = network.name;
  await ensureNetworkReady(networkName);

  const deployment = readDeployment("primary", networkName);
  if (!deployment?.address) {
    throw new Error(`Missing primary deployment for ${networkName}. Deploy the contract first.`);
  }

  return { env, networkName, contractAddress: deployment.address };
}

async function main(): Promise<void> {
  const { env, networkName, contractAddress } = await getReadyState();

  const [signer] = await ethers.getSigners();
  if (!signer) {
    throw new Error("No signer configured for this network.");
  }
  const signerAddress = await signer.getAddress();

  const contract = await ethers.getContractAt("SuMain", contractAddress, signer);
  const currentExecutive = await contract.executiveOfficerAddress();

  if (signerAddress.toLowerCase() !== currentExecutive.toLowerCase()) {
    throw new Error(
      `Signer ${signerAddress} is not the current executive officer (${currentExecutive}). Use the CEO key.`,
    );
  }

  const target = env.COO_ADDRESS;
  const currentCoo = await contract.operatingOfficerAddress();

  if (target.toLowerCase() === currentCoo.toLowerCase()) {
    console.log(
      chalk.yellow(
        `Operating officer already set to ${chalk.bold(target)} on ${chalk.bold(networkName)}.`,
      ),
    );
    return;
  }

  console.log(
    chalk.cyan(
      `Assigning operating officer on ${chalk.bold(networkName)} (contract ${contractAddress})...`,
    ),
  );
  const tx = await contract.setOperatingOfficer(target);
  const receipt = await tx.wait();
  console.log(
    chalk.green(
      `Operating officer updated from ${currentCoo} to ${target} on ${networkName}. Tx: ${
        receipt?.hash ?? tx.hash
      }`,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
