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

  const contractAddress = deployment.address;
  const provider = ethers.provider;

  const contractBalance = await provider.getBalance(contractAddress);

  const contract = await ethers.getContractAt("SuMain", contractAddress);
  const cfo: string = await contract.financialOfficerAddress();

  console.log(chalk.blueBright("=== Withdrawal Readiness Check ==="));
  console.log(
    chalk.cyan(
      `Network: ${chalk.bold(networkName)}\n` +
        `Contract: ${chalk.bold(contractAddress)}\n`,
    ),
  );

  console.log(
    chalk.magenta(
      `Contract balance: ${chalk.bold(ethers.formatEther(contractBalance))} ETH`,
    ),
  );

  if (cfo === ethers.ZeroAddress) {
    console.log(
      chalk.yellow(
        "No CFO is currently assigned on-chain (financialOfficerAddress is the zero address).",
      ),
    );
    console.log(
      chalk.yellow(
        "Assign a CFO before attempting withdrawal (use your CFO assignment script).",
      ),
    );
  } else {
    console.log(
      chalk.green(
        `Current CFO address: ${chalk.bold(cfo)}`,
      ),
    );
    console.log(
      chalk.gray(
        "CFO must be the caller when running the withdrawal script.",
      ),
    );
  }

  console.log(chalk.blueBright("=================================="));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
