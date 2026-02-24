import chalk from "chalk";
import { ethers, network } from "hardhat";

import { readDeployment } from "@script-utils/deployments";
import { ensureNetworkIsReachable, ensureSunetReady } from "@script-utils/network";
import {
  ensureMetadataForToken,
  HREF_MAX_BYTES,
  TITLE_MAX_BYTES,
  loadMetadata,
  loadRgbDataForToken,
  validateTextLength,
} from "@script-utils/image";
import { resolvePersonalizerSigner } from "@script-utils/personalization-signer";

const TOKEN_ENV = "PERSONALIZE_TOKEN_ID";

async function ensureNetworkReady(): Promise<ReturnType<typeof ensureSunetReady> | undefined> {
  if (network.name === "sunet") {
    return await ensureSunetReady();
  }
  await ensureNetworkIsReachable(network.name);
  return undefined;
}

function parseTokenId(): number {
  const raw = (process.env[TOKEN_ENV] || "").trim();
  if (!raw) {
    throw new Error(`Environment variable ${TOKEN_ENV} is required (see ${TOKEN_ENV}).`);
  }
  const tokenId = Number(raw);
  if (!Number.isInteger(tokenId) || tokenId <= 0) {
    throw new Error(`${TOKEN_ENV} must be a positive integer.`);
  }
  return tokenId;
}

async function main(): Promise<void> {
  const tokenId = parseTokenId();
  const metadata = loadMetadata();
  const entry = ensureMetadataForToken(metadata, tokenId);

  validateTextLength("Title", entry.title, TITLE_MAX_BYTES);
  validateTextLength("Href", entry.href, HREF_MAX_BYTES);

  const rgbData = await loadRgbDataForToken(tokenId);
  const sunetEnv = await ensureNetworkReady();

  const networkName = network.name;
  const deployment = readDeployment("primary", networkName);
  if (!deployment?.address) {
    throw new Error(`Missing primary deployment for ${networkName}.`);
  }

  const signer = await resolvePersonalizerSigner(networkName, sunetEnv);
  const contract = await ethers.getContractAt("SuMain", deployment.address, signer);
  const price = await contract.personalizationPrice();
  const square = await contract.suSquares(tokenId);
  const version = Number(square.version ?? 0);
  const requiresPayment = version >= 3;
  const tx = await contract.personalizeSquare(tokenId, rgbData, entry.title, entry.href, {
    value: requiresPayment ? price : 0n,
  });

  console.log(chalk.cyan(`Personalizing token ${tokenId} on primary (${networkName})...`));
  const receipt = await tx.wait();
  console.log(
    chalk.green(
      `Personalized token ${tokenId} on primary at ${deployment.address} (tx ${receipt?.transactionHash})`,
    ),
  );
  if (!requiresPayment) {
    console.log(chalk.yellow("Token was still under free personalization quota (versions 1-3)."));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
