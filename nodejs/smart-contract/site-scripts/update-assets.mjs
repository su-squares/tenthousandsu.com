#!/usr/bin/env node
/**
 * Chain-aware asset builder for Su Squares.
 * Outputs:
 * - build[-<network>]/{loadedTo.json,squarePersonalizations.json,underlayPersonalizations.json,squareExtra.json,wholeSquare.png}
 * - erc721[-<network>]/{#####.json,#####.svg}
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import chalk from "chalk";
import { loadContractsConfig, SETTLE_BLOCKS } from "./update-assets/contracts.mjs";
import { createImagePipeline } from "./update-assets/image-processing.mjs";
import { publishMetadataJson } from "./update-assets/metadata.mjs";
import { NUM_SQUARES } from "./update-assets/geometry.mjs";
import { queryFilterChunked } from "./event-listener/query-filter-chunked.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..", "..");

dotenv.config({ path: path.join(repoRoot, "nodejs", "smart-contract", ".env.site") });
dotenv.config({ path: path.join(repoRoot, "nodejs", "smart-contract", ".env.contract") });

function normalizeNetwork(raw) {
  const value = (raw || "mainnet").toString().toLowerCase();
  if (["mainnet", "sepolia", "sunet"].includes(value)) return value;
  return "mainnet";
}

function parseArgs() {
  const args = process.argv.slice(2);
  const networkArg = args.find((a) => a.startsWith("--network="));
  const blocksArg = args.find((a) => a.startsWith("--blocks="));
  const network = normalizeNetwork(networkArg ? networkArg.split("=")[1] : process.env.CHAIN || "mainnet");
  const blocksToProcess = blocksArg ? parseInt(blocksArg.split("=")[1], 10) : null;
  return { network, blocksToProcess };
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function buildPaths(network) {
  const buildDir = path.join(repoRoot, network === "mainnet" ? "build" : `build-${network}`);
  const metadataDir = path.join(repoRoot, network === "mainnet" ? "erc721" : `erc721-${network}`);
  return {
    buildDir,
    metadataDir,
    loadedTo: path.join(buildDir, "loadedTo.json"),
    squarePersonalizations: path.join(buildDir, "squarePersonalizations.json"),
    underlayPersonalizations: path.join(buildDir, "underlayPersonalizations.json"),
    squareExtra: path.join(buildDir, "squareExtra.json"),
  };
}

async function main() {
  const { network, blocksToProcess } = parseArgs();
  const paths = buildPaths(network);
  ensureDir(paths.buildDir);
  ensureDir(paths.metadataDir);

  const { provider, suSquares, underlay, deploymentBlock, tokenUriBase } = loadContractsConfig({ network, repoRoot });
  const siteBase = process.env.SITE_BASE || "https://tenthousandsu.com";
  const numberOfBlocksToProcess = blocksToProcess || 1_000_000;
  const pipeline = createImagePipeline({ repoRoot, buildDir: paths.buildDir, metadataDir: paths.metadataDir });

  const nonpersonalizedPixelData = Buffer.from("E6".repeat(300), "hex"); // Gray
  const blackPixelData = Buffer.from("00".repeat(300), "hex"); // Black

  let state = {
    loadedTo: deploymentBlock,
    squarePersonalizations: Array(NUM_SQUARES).fill(null),
    underlayPersonalizations: Array(NUM_SQUARES).fill(null),
    squareExtra: Array(NUM_SQUARES).fill(null),
  };

  if (
    fs.existsSync(paths.loadedTo) &&
    fs.existsSync(paths.squarePersonalizations) &&
    fs.existsSync(paths.underlayPersonalizations) &&
    fs.existsSync(paths.squareExtra)
  ) {
    state.loadedTo = JSON.parse(fs.readFileSync(paths.loadedTo, "utf8"));
    state.squarePersonalizations = JSON.parse(fs.readFileSync(paths.squarePersonalizations, "utf8"));
    state.underlayPersonalizations = JSON.parse(fs.readFileSync(paths.underlayPersonalizations, "utf8"));
    state.squareExtra = JSON.parse(fs.readFileSync(paths.squareExtra, "utf8"));
  }

  const currentSettledBlock = (await provider.getBlockNumber()) - SETTLE_BLOCKS;
  const endBlock = Math.min(state.loadedTo + numberOfBlocksToProcess, currentSettledBlock);

  console.log(chalk.cyan(`Network: ${network}`));
  console.log(chalk.blue("Loaded to:             ") + state.loadedTo);
  console.log(chalk.blue("Loading to:            ") + endBlock);
  console.log(chalk.blue("Current settled block: ") + currentSettledBlock);

  const suSquaresConnected = suSquares.connect(provider);
  const underlayConnected = underlay.connect(provider);

  const INITIAL_STEP = parseInt(process.env.RPC_LOGS_CHUNK_SIZE || "2000", 10);
  const MIN_STEP = parseInt(process.env.RPC_LOGS_MIN_CHUNK_SIZE || "25", 10);

  const suSquaresAddress = await suSquaresConnected.getAddress();

  const filterSold = suSquaresConnected.filters.Transfer(suSquaresAddress, null, null);
  const sold = await queryFilterChunked(suSquaresConnected, filterSold, state.loadedTo + 1, endBlock, {
    initialStep: Number.isFinite(INITIAL_STEP) ? INITIAL_STEP : 2000,
    minStep: Number.isFinite(MIN_STEP) ? MIN_STEP : 25,
  });

  const filterPersonalized = suSquaresConnected.filters.Personalized();
  const personalized = await queryFilterChunked(suSquaresConnected, filterPersonalized, state.loadedTo + 1, endBlock, {
    initialStep: Number.isFinite(INITIAL_STEP) ? INITIAL_STEP : 2000,
    minStep: Number.isFinite(MIN_STEP) ? MIN_STEP : 25,
  });

  const filterUnderlay = underlayConnected.filters.PersonalizedUnderlay();
  const personalizedUnderlay = await queryFilterChunked(underlayConnected, filterUnderlay, state.loadedTo + 1, endBlock, {
    initialStep: Number.isFinite(INITIAL_STEP) ? INITIAL_STEP : 2000,
    minStep: Number.isFinite(MIN_STEP) ? MIN_STEP : 25,
  });

  if (personalized.length > 100) {
    console.log(chalk.red("Too many personalized events, server will choke. Try updating fewer. Exiting."));
    process.exit(1);
  }

  function personalize(squareNumber, title, href, rgbData) {
    state.squarePersonalizations[squareNumber - 1] = [title, href];
    publishMetadataJson({
      squareNumber,
      title,
      metadataDir: paths.metadataDir,
      tokenUriBase,
      siteBase,
    });
    pipeline.paintSuSquare(squareNumber, rgbData);
    pipeline.publishSquareImageWithRGBData(squareNumber, rgbData);
  }

  for (const event of sold) {
    const squareNumber = Number(event.args.squareNumber);
    console.log(`Sold: ${squareNumber} at block ${event.blockNumber}`);
    state.squareExtra[squareNumber - 1] = [event.blockNumber, event.blockNumber, false, 0];
    personalize(squareNumber, "", "", nonpersonalizedPixelData);
  }

  for (const event of personalizedUnderlay) {
    const squareNumber = Number(event.args.squareId ?? event.args.squareNumber);
    console.log(`Personalized underlay: ${squareNumber} at block ${event.blockNumber}`);
    state.underlayPersonalizations[squareNumber - 1] = [
      event.args.title,
      event.args.href,
      event.args.rgbData.substr(2),
    ];
    if (state.squareExtra[squareNumber - 1] && state.squareExtra[squareNumber - 1][2] === false) {
      state.squareExtra[squareNumber - 1][1] = event.blockNumber;
      personalize(squareNumber, event.args.title, event.args.href, Buffer.from(event.args.rgbData.substr(2), "hex"));
    }
  }

  for await (const event of personalized) {
    const squareNumber = Number(event.args.squareNumber);
    console.log(`Personalized main contract: ${squareNumber} at block ${event.blockNumber}`);
    let { version, title, href, rgbData } = await suSquaresConnected.suSquares(squareNumber);

    const mainIsPersonalized = title !== "" || href !== "" || rgbData !== "0x" + blackPixelData.toString("hex");

    if (!state.squareExtra[squareNumber - 1]) {
      state.squareExtra[squareNumber - 1] = [event.blockNumber, event.blockNumber, mainIsPersonalized, Number(version)];
    } else {
      state.squareExtra[squareNumber - 1] = [
        state.squareExtra[squareNumber - 1][0],
        event.blockNumber,
        mainIsPersonalized,
        Number(version),
      ];
    }

    if (mainIsPersonalized) {
      personalize(squareNumber, title, href, Buffer.from(rgbData.substr(2), "hex"));
    } else if (state.underlayPersonalizations[squareNumber - 1] !== null) {
      personalize(
        squareNumber,
        state.underlayPersonalizations[squareNumber - 1][0],
        state.underlayPersonalizations[squareNumber - 1][1],
        Buffer.from(state.underlayPersonalizations[squareNumber - 1][2], "hex"),
      );
    } else {
      personalize(squareNumber, "", "", nonpersonalizedPixelData);
    }
  }

  state.loadedTo = endBlock;
  await pipeline.saveWholeSuSquare();
  fs.writeFileSync(paths.loadedTo, JSON.stringify(state.loadedTo));
  fs.writeFileSync(paths.squarePersonalizations, JSON.stringify(state.squarePersonalizations));
  fs.writeFileSync(paths.underlayPersonalizations, JSON.stringify(state.underlayPersonalizations));
  fs.writeFileSync(paths.squareExtra, JSON.stringify(state.squareExtra));

  console.log(chalk.green(`Updated assets for ${network} up to block ${endBlock}`));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
