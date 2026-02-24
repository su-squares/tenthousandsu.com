import chalk from "chalk";
import { ethers, network } from "hardhat";
import { isAddress } from "ethers";

import { readDeployment } from "@script-utils/deployments";
import { ensureNetworkIsReachable, ensureSunetReady } from "@script-utils/network";

const PROMO_TOKENID_ENV = "PROMO_TOKENID";
const PROMO_RECIPIENT_ENV = "PROMO_RECIPIENT_ADDRESS";

async function ensureNetworkReady(networkName: string): Promise<void> {
  if (networkName === "sunet") {
    await ensureSunetReady();
  } else {
    await ensureNetworkIsReachable(networkName);
  }
}

function requirePromoEnv(): { tokenId: number; recipient: string } {
  const tokenIdRaw = (process.env[PROMO_TOKENID_ENV] || "").trim();
  const recipient = (process.env[PROMO_RECIPIENT_ENV] || "").trim();

  if (!tokenIdRaw) {
    throw new Error(
      `Missing ${PROMO_TOKENID_ENV}. Set it in nodejs/smart-contract/.env.contract before running.`,
    );
  }
  if (!recipient) {
    throw new Error(
      `Missing ${PROMO_RECIPIENT_ENV}. Set it in nodejs/smart-contract/.env.contract before running.`,
    );
  }
  if (!isAddress(recipient)) {
    throw new Error(`${PROMO_RECIPIENT_ENV} must be a valid 0x address.`);
  }

  const tokenId = Number(tokenIdRaw);
  if (!Number.isInteger(tokenId) || tokenId <= 0) {
    throw new Error(`${PROMO_TOKENID_ENV} must be a positive integer.`);
  }

  return { tokenId, recipient };
}

async function main(): Promise<void> {
  const { tokenId, recipient } = requirePromoEnv();

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
  const currentCoo: string = await contract.operatingOfficerAddress();

  if (currentCoo === ethers.ZeroAddress) {
    throw new Error(
      `No COO assigned on-chain. Run the COO assignment script to set one before transferring promo tokens.`,
    );
  }

  if (signerAddress.toLowerCase() !== currentCoo.toLowerCase()) {
    throw new Error(
      `Signer ${signerAddress} is not the current COO (${currentCoo}). Use the COO key or reassign the role first.`,
    );
  }

  console.log(
    chalk.cyan(
      `Granting promo token ${chalk.bold(tokenId)} on ${chalk.bold(networkName)} to ${chalk.bold(
        recipient,
      )} from contract ${chalk.bold(deployment.address)}...`,
    ),
  );
  const tx = await contract.grantToken(tokenId, recipient);
  const receipt = await tx.wait();
  console.log(
    chalk.green(
      `Promo token ${tokenId} sent to ${recipient}. Tx: ${chalk.bold(receipt?.hash ?? tx.hash)}`,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
