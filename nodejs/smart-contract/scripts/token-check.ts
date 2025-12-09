import chalk from "chalk";
import { ethers, network } from "hardhat";
import type { BytesLike, Contract, Event } from "ethers";

import { readDeployment, DeploymentRecord } from "@script-utils/deployments";
import { loadTokenCheckEnv } from "@script-utils/env";
import { ensureNetworkIsReachable, ensureSunetReady } from "@script-utils/network";

async function ensureNetworkReady(networkName: string): Promise<void> {
  if (networkName === "sunet") {
    await ensureSunetReady();
  } else {
    await ensureNetworkIsReachable(networkName);
  }
}

async function getReadyState(): Promise<{
  tokenId: number;
  networkName: string;
  primaryDeployment: DeploymentRecord;
  underlayDeployment: DeploymentRecord | null;
}> {
  const env = loadTokenCheckEnv({ required: true });
  if (!env) {
    throw new Error("Token check environment missing token id.");
  }

  const networkName = network.name;
  await ensureNetworkReady(networkName);

  const primaryDeployment = readDeployment("primary", networkName);
  if (!primaryDeployment?.address) {
    throw new Error(`Missing primary deployment for ${networkName}. Deploy the main contract first.`);
  }

  const underlayDeployment = readDeployment("underlay", networkName);

  return {
    tokenId: env.tokenId,
    networkName,
    primaryDeployment,
    underlayDeployment,
  };
}

function describeRgb(data?: BytesLike | null): string {
  if (!data) {
    return "not set";
  }
  const hex = ethers.hexlify(data);
  if (hex === "0x") {
    return "empty (0 bytes)";
  }
  const bytes = (hex.length - 2) / 2;
  const preview = hex.length > 66 ? `${hex.slice(0, 66)}...` : hex;
  return `${bytes} bytes (${preview})`;
}

function formatEth(value?: ethers.BigNumberish | null): string {
  if (value === null || value === undefined) {
    return "n/a";
  }
  try {
    return `${ethers.formatEther(value)} ETH`;
  } catch {
    return value.toString();
  }
}

async function queryLatestUnderlayEvent(
  contract: Contract,
  tokenId: number,
  fromBlock: number,
): Promise<Event | null> {
  const filter = contract.filters.PersonalizedUnderlay(tokenId);
  const events = await contract.queryFilter(filter, fromBlock, "latest");

  return events.reduce<Event | null>((latest, event) => {
    if (!latest) {
      return event;
    }
    if (
      (event.blockNumber ?? 0) > (latest.blockNumber ?? 0) ||
      ((event.blockNumber ?? 0) === (latest.blockNumber ?? 0) &&
        (event.logIndex ?? 0) > (latest.logIndex ?? 0))
    ) {
      return event;
    }
    return latest;
  }, null);
}

async function main(): Promise<void> {
  const { tokenId, networkName, primaryDeployment, underlayDeployment } = await getReadyState();
  const provider = ethers.provider;

  const primaryContract = await ethers.getContractAt("SuMain", primaryDeployment.address, provider);
  const owner = await primaryContract.ownerOf(tokenId);
  const square = await primaryContract.suSquares(tokenId);
  const personalizationPrice = await primaryContract.personalizationPrice();
  const version = Number(square.version ?? 0);

  const primaryRgbHex = square.rgbData ? ethers.hexlify(square.rgbData) : "0x";
  const primaryRgb = describeRgb(primaryRgbHex);
  const EMPTY_RGB_HEX = `0x${"00".repeat(300)}`;
  const rgbIsEmpty = primaryRgbHex === EMPTY_RGB_HEX || primaryRgbHex === "0x";
  const owningByContract = owner.toLowerCase() === primaryDeployment.address.toLowerCase();
  const title = square.title?.toString?.() || "<empty>";
  const href = square.href?.toString?.() || "<empty>";
  const isPersonalized = version > 0;
  const metadataIsEmpty = title === "<empty>" && href === "<empty>";
  const dataIsEmpty = isPersonalized && rgbIsEmpty && metadataIsEmpty;

  console.log(chalk.bold.blue(`Token check #${tokenId} on ${networkName}`));
  console.log(`Primary contract: ${primaryDeployment.address}`);
  console.log(`Owner: ${owner}`);
  console.log(
    `Held by contract (available for sale/promo): ${owningByContract ? chalk.yellow("yes") : "no"}`,
  );
  const personalizedLabel = !isPersonalized
    ? chalk.gray("no")
    : dataIsEmpty
      ? chalk.green("yes, but data empty")
      : chalk.green("yes");
  console.log(`Personalized on primary: ${personalizedLabel} (version ${version})`);
  if (version > 3) {
    console.log(chalk.cyan("Personalization paid phase reached (version > 3)."));
  }
  console.log(`Personalization price: ${formatEth(personalizationPrice)}`);
  console.log(`Title: ${title}`);
  console.log(`Href: ${href}`);
  console.log(`Image data: ${primaryRgb}`);
  if (dataIsEmpty) {
    console.log(
      chalk.green(
        `[Empty fields means it's considered "unpersonalized" for the site and will default to the underlay's personalization]`,
      ),
    );
  }

  if (!underlayDeployment?.address) {
    console.log(chalk.yellow("Underlay not deployed on this network; skipping underlay checks."));
    return;
  }

  const underlayContract = await ethers.getContractAt("SuSquaresUnderlay", underlayDeployment.address, provider);
  const underlayPrice = await underlayContract.pricePerSquare();
  const latestEvent = await queryLatestUnderlayEvent(
    underlayContract,
    tokenId,
    underlayDeployment.blockNumber ?? 0,
  );

  console.log(chalk.bold.blue(`\nUnderlay contract: ${underlayDeployment.address}`));
  console.log(`Price per square: ${formatEth(underlayPrice)}`);
  if (!latestEvent) {
    console.log(chalk.yellow("Token has not been personalized on the underlay yet."));
  } else {
    const args = (latestEvent.args || {}) as {
      title?: string;
      href?: string;
      rgbData?: BytesLike;
    };
    console.log(
      `Last personalization event: block ${latestEvent.blockNumber} tx ${latestEvent.transactionHash}`,
    );
    console.log(`Title: ${args.title || "<empty>"}`);
    console.log(`Href: ${args.href || "<empty>"}`);
    console.log(`Image data: ${describeRgb(args.rgbData)}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
