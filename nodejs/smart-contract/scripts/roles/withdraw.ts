import chalk from "chalk";
import { ethers, network } from "hardhat";

import { readDeployment } from "@script-utils/deployments";
import { ensureNetworkIsReachable, ensureSunetReady } from "@script-utils/network";

async function ensureNetworkReady(networkName: string): Promise<void> {
  if (networkName === "sunet") {
    await ensureSunetReady();
  } else {
    await ensureNetworkIsReachable(networkName);
  }
}

async function main(): Promise<void> {
  const networkName = network.name;
  await ensureNetworkReady(networkName);

  const deployment = readDeployment("primary", networkName);
  if (!deployment?.address) {
    throw new Error(`Missing primary deployment for ${networkName}. Deploy the contract first.`);
  }

  const [signer] = await ethers.getSigners();
  if (!signer) {
    throw new Error("No signer configured for this network.");
  }

  const signerAddress = await signer.getAddress();
  const contract = await ethers.getContractAt("SuMain", deployment.address, signer);
  const cfo = await contract.financialOfficerAddress();

  if (cfo === ethers.ZeroAddress) {
    throw new Error(
      `No CFO assigned on-chain. Assign a CFO before withdrawing (use the CFO assignment script).`,
    );
  }

  if (signerAddress.toLowerCase() !== cfo.toLowerCase()) {
    throw new Error(
      `Signer ${signerAddress} is not the CFO (${cfo}). Use the CFO key or reassign the role first.`,
    );
  }

  const contractBalance = await ethers.provider.getBalance(deployment.address);
  if (contractBalance === 0n) {
    console.log(chalk.yellow("Contract balance is 0; nothing to withdraw."));
    return;
  }

  console.log(
    chalk.cyan(
      `Withdrawing ${chalk.bold(
        ethers.formatEther(contractBalance),
      )} ETH from ${chalk.bold(deployment.address)} on ${chalk.bold(networkName)} to CFO ${chalk.bold(cfo)}...`,
    ),
  );
  const tx = await contract.withdrawBalance();
  const receipt = await tx.wait();
  console.log(chalk.green(`Withdraw complete. Tx: ${chalk.bold(receipt?.hash ?? tx.hash)}`));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
