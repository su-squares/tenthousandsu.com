import chalk from "chalk";
import { ethers, network } from "hardhat";
import { verifyContractIfPossible, writeDeployment } from "@script-utils/deployments";
import { ensureNetworkIsReachable, ensureSunetReady } from "@script-utils/network";
import { SunetEnv, resolveTokenUriBase } from "@script-utils/env";

type DeployResult = {
  address: string;
  chainId: number;
  sunetEnv?: SunetEnv;
};

export async function deployPrimary(): Promise<DeployResult> {
  let sunetEnv: SunetEnv | undefined;
  if (network.name === "sunet") {
    sunetEnv = await ensureSunetReady();
  } else {
    await ensureNetworkIsReachable(network.name);
  }

  const [deployer] = await ethers.getSigners();
  const chain = await ethers.provider.getNetwork();
  const chainId = Number(chain.chainId);

  const tokenUriBase = resolveTokenUriBase(network.name);

  console.log(
    chalk.cyan(
      `Deploying SuMain to ${chalk.bold(network.name)} (chainId ${chainId}) with deployer ${chalk.bold(deployer.address)}`,
    ),
  );

  const contract = await ethers.deployContract("SuMain", [tokenUriBase]);
  const deploymentTx = contract.deploymentTransaction();
  const receipt = deploymentTx ? await deploymentTx.wait(1) : undefined;
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(chalk.green(`SuMain deployed at ${chalk.bold(address)}`));

  const verification = await verifyContractIfPossible({
    contractName: "SuMain",
    address,
    constructorArguments: [tokenUriBase],
    networkName: network.name,
    explorerHint: network.name === "sunet" ? sunetEnv?.blockscoutBrowserUrl : undefined,
    isBlockscout: network.name === "sunet",
  });

  await writeDeployment("primary", network.name, {
    address,
    chainId,
    deployer: deployer.address,
    txHash: receipt?.hash ?? deploymentTx?.hash,
    blockNumber: receipt?.blockNumber,
    deployedAt: new Date().toISOString(),
    verification,
  });

  return { address, chainId, sunetEnv };
}

async function main(): Promise<void> {
  await deployPrimary();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
