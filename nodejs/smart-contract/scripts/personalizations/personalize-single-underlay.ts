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
  const deployment = readDeployment("underlay", networkName);
  if (!deployment?.address) {
    throw new Error(`Missing underlay deployment for ${networkName}.`);
  }

  const signer = await resolvePersonalizerSigner(networkName, sunetEnv);
  const contract = await ethers.getContractAt("SuSquaresUnderlay", deployment.address, signer);
  const price = await contract.pricePerSquare();

  console.log(chalk.cyan(`Personalizing token ${tokenId} on underlay (${networkName})...`));
  const tx = await contract.personalizeSquareUnderlay(tokenId, rgbData, entry.title, entry.href, {
    value: price,
  });
  const receipt = await tx.wait();
  console.log(
    chalk.green(
      `Personalized token ${tokenId} on underlay at ${deployment.address} (tx ${receipt?.transactionHash})`,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
