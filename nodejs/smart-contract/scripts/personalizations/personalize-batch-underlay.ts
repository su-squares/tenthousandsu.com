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
import { expandTokenRange, summarizeTokenIds } from "@script-utils/token-input";
import { resolvePersonalizerSigner } from "@script-utils/personalization-signer";

const TOKEN_INPUT_ENV = "PERSONALIZE_BATCH_TOKENS";
const DEFAULT_TOKEN_INPUT = "1";

async function ensureNetworkReady(): Promise<ReturnType<typeof ensureSunetReady> | undefined> {
  if (network.name === "sunet") {
    return await ensureSunetReady();
  }
  await ensureNetworkIsReachable(network.name);
  return undefined;
}

async function main(): Promise<void> {
  const tokenInput = process.env[TOKEN_INPUT_ENV] || DEFAULT_TOKEN_INPUT;
  const tokenIds = expandTokenRange(tokenInput, TOKEN_INPUT_ENV);
  if (tokenIds.length === 0) {
    throw new Error(`No tokens specified in ${TOKEN_INPUT_ENV}.`);
  }

  const metadata = loadMetadata();
  const sunetEnv = await ensureNetworkReady();

  const networkName = network.name;
  const deployment = readDeployment("underlay", networkName);
  if (!deployment?.address) {
    throw new Error(`Missing underlay deployment for ${networkName}.`);
  }

  type UnderlayPayload = {
    squareId: number;
    rgbData: Buffer;
    title: string;
    href: string;
  };

  const payload: UnderlayPayload[] = [];
  for (const tokenId of tokenIds) {
    const entry = ensureMetadataForToken(metadata, tokenId);
    validateTextLength("Title", entry.title, TITLE_MAX_BYTES);
    validateTextLength("Href", entry.href, HREF_MAX_BYTES);
    const rgbData = await loadRgbDataForToken(tokenId);
    payload.push({
      squareId: tokenId,
      rgbData,
      title: entry.title,
      href: entry.href,
    });
  }

  const signer = await resolvePersonalizerSigner(networkName, sunetEnv);
  const contract = await ethers.getContractAt("SuSquaresUnderlay", deployment.address, signer);
  const pricePerSquare = await contract.pricePerSquare();
  const totalValue = pricePerSquare * BigInt(payload.length);

  console.log(chalk.cyan(`Batch personalizing ${tokenIds.length} underlay tokens on ${networkName}...`));
  console.log(`Tokens: ${summarizeTokenIds(tokenIds)}`);
  console.log(`Contract: ${deployment.address}`);
  console.log(`Total value to send: ${ethers.formatEther(totalValue)} ETH`);

  const tx = await contract.personalizeSquareUnderlayBatch(payload, {
    value: totalValue,
  });
  const receipt = await tx.wait();
  console.log(
    chalk.green(
      `Batch personalization succeeded in tx ${receipt?.transactionHash} (${tokenIds.length} tokens)`,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
