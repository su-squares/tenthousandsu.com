import chalk from "chalk";
import { ethers, network } from "hardhat";
import { readDeployment } from "@script-utils/deployments";
import { ensureNetworkIsReachable, ensureSunetReady } from "@script-utils/network";

// Hardcoded because Solidity `constant` values are not exposed via the ABI
const PROMO_CREATION_LIMIT = 5000n;

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

  const contract = await ethers.getContractAt("SuMain", deployment.address);

  const [promoUsed, balance] = await Promise.all([
    contract.promoCreatedCount(),
    contract.balanceOf(deployment.address),
  ]);

  const promoLimit = PROMO_CREATION_LIMIT;
  const remainingPromo = promoLimit - promoUsed;
  const eligibleToGrant = remainingPromo > balance ? balance : remainingPromo;

  console.log(chalk.blueBright(`\nPromo status for ${chalk.bold(networkName)}:`));
  console.log(chalk.gray(`Contract: ${deployment.address}\n`));
  console.log(
    `${chalk.gray("Promo limit")}: ${chalk.green(promoLimit.toString())} | ${chalk.gray("Used")}: ${chalk.yellow(
      promoUsed.toString(),
    )} | ${chalk.gray("Remaining")}: ${chalk.green(remainingPromo.toString())}`,
  );
  console.log(
    `${chalk.gray("NFTs held by contract")}: ${chalk.green(balance.toString())}`,
  );
  console.log(
    `${chalk.gray("Eligible to grant now")}: ${eligibleToGrant > 0n ? chalk.green(eligibleToGrant.toString()) : chalk.red("0 (none available)")}`,
  );
  console.log();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});