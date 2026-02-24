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

function formatRole(name: string, value: string): string {
  if (!value || value === ethers.ZeroAddress) {
    return `${chalk.gray(name)}: ${chalk.yellow("not assigned")}`;
  }
  return `${chalk.gray(name)}: ${chalk.green(value)}`;
}

async function main(): Promise<void> {
  const networkName = network.name;
  await ensureNetworkReady(networkName);

  const deployment = readDeployment("primary", networkName);
  if (!deployment?.address) {
    throw new Error(`Missing primary deployment for ${networkName}. Deploy the contract first.`);
  }

  const contract = await ethers.getContractAt("SuMain", deployment.address);

  const [executive, financial, operating] = await Promise.all([
    contract.executiveOfficerAddress(),
    contract.financialOfficerAddress(),
    contract.operatingOfficerAddress(),
  ]);

  console.log(chalk.blueBright(`\nRole assignments for ${chalk.bold(networkName)}:`));
  console.log(chalk.gray(`Contract: ${deployment.address}\n`));
  console.log(formatRole("CEO (executive)", executive));
  console.log(formatRole("CFO (financial)", financial));
  console.log(formatRole("COO (operating)", operating));
  console.log();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
