import chalk from "chalk";
import { ethers, network } from "hardhat";
import {
  readDeployment,
  verifyContractIfPossible,
  writeDeployment,
} from "@script-utils/deployments";
import { ensureNetworkIsReachable, ensureSunetReady } from "@script-utils/network";
import { SunetEnv, loadContractPricingEnv } from "@script-utils/env";

type DeployUnderlayOptions = {
  primaryAddress?: string;
};

type DeployResult = {
  address: string;
  chainId: number;
  primaryAddress: string;
  sunetEnv?: SunetEnv;
};

export async function deployUnderlay(
  options: DeployUnderlayOptions = {},
): Promise<DeployResult> {
  let sunetEnv: SunetEnv | undefined;
  if (network.name === "sunet") {
    sunetEnv = await ensureSunetReady();
  } else {
    await ensureNetworkIsReachable(network.name);
  }

  const pricing = loadContractPricingEnv();

  const chain = await ethers.provider.getNetwork();
  const chainId = Number(chain.chainId);

  let primaryAddress = options.primaryAddress;
  if (!primaryAddress) {
    const primaryDeployment = readDeployment("primary", network.name);
    primaryAddress = primaryDeployment?.address;
    if (!primaryAddress) {
      throw new Error(
        `Primary contract is not deployed for ${network.name}. Deploy primary first or run scripts/deploy/deploy-all.ts.`,
      );
    }
  }

  if (!ethers.isAddress(primaryAddress)) {
    throw new Error(
      `Primary contract address ${primaryAddress} is not valid for ${network.name}.`,
    );
  }

  const [deployer] = await ethers.getSigners();
  console.log(
    chalk.cyan(
      `Deploying SuSquaresUnderlay to ${chalk.bold(network.name)} (chainId ${chainId}) using primary at ${chalk.bold(primaryAddress)}`,
    ),
  );

  const contract = await ethers.deployContract("SuSquaresUnderlay", [
    primaryAddress,
    pricing.underlayPersonalizationPriceWei,
  ]);
  const deploymentTx = contract.deploymentTransaction();
  const receipt = deploymentTx ? await deploymentTx.wait(1) : undefined;
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(chalk.green(`SuSquaresUnderlay deployed at ${chalk.bold(address)}`));

  const verification = await verifyContractIfPossible({
    contractName: "SuSquaresUnderlay",
    address,
    constructorArguments: [primaryAddress, pricing.underlayPersonalizationPriceWei],
    networkName: network.name,
    explorerHint: network.name === "sunet" ? sunetEnv?.blockscoutBrowserUrl : undefined,
    isBlockscout: network.name === "sunet",
  });

  await writeDeployment("underlay", network.name, {
    address,
    chainId,
    deployer: deployer.address,
    txHash: receipt?.hash ?? deploymentTx?.hash,
    blockNumber: receipt?.blockNumber,
    deployedAt: new Date().toISOString(),
    primaryAddress,
    verification,
  });

  return { address, chainId, primaryAddress, sunetEnv };
}

async function main(): Promise<void> {
  await deployUnderlay();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
