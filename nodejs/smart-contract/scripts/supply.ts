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
  const contract = await ethers.getContractAt(
    "SuMain",
    deployment.address,
    signer ?? ethers.provider,
  );

  const [name, symbol, totalSupplyRaw, heldRaw] = await Promise.all([
    contract.name(),
    contract.symbol(),
    contract.totalSupply(),
    contract.balanceOf(deployment.address),
  ]);

  const totalSupply = Number(totalSupplyRaw);
  const heldByContract = Number(heldRaw);
  const distributed = totalSupply - heldByContract;

  console.log(chalk.cyan(`\nSuMain supply on ${chalk.bold(networkName)}`));
  console.log(`Contract: ${chalk.bold(deployment.address)}`);
  console.log(`Name: ${name}`);
  console.log(`Symbol: ${symbol}`);
  console.log(`Total supply: ${totalSupply}`);
  console.log(`Held by contract: ${heldByContract}`);
  console.log(`Distributed to holders: ${distributed}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
