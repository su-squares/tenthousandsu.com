import { ethers, network } from "hardhat";
import { verifyContractIfPossible, writeDeployment } from "./helpers/deployments";
import { ensureNetworkIsReachable, ensureSunetReady } from "./helpers/network";
import { SunetEnv } from "./helpers/env";

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

  console.log(
    `Deploying SuMain to ${network.name} (chainId ${chainId}) with deployer ${deployer.address}`,
  );

  const contract = await ethers.deployContract("SuMain");
  const deploymentTx = contract.deploymentTransaction();
  const receipt = deploymentTx ? await deploymentTx.wait(1) : undefined;
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`SuMain deployed at ${address}`);

  const verification = await verifyContractIfPossible({
    contractName: "SuMain",
    address,
    constructorArguments: [],
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
    console.error(error);
    process.exitCode = 1;
  });
}
