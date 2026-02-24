/**
 * Historical event catch-up module.
 * Queries past events that occurred while the listener was offline.
 *
 * Uses chunked querying to avoid RPC eth_getLogs max-range limits.
 */
import chalk from "chalk";
import { queryFilterChunked } from "./query-filter-chunked.mjs";

// ============================================================================
// Historical Event Catch-up
// ============================================================================

export async function catchUpMissedEvents(provider, contracts, fromBlock, toBlock) {
  const { primaryContract, underlayContract, primaryAddress } = contracts;

  console.log(chalk.yellow(`\nCatching up on events from block ${fromBlock} to ${toBlock}...`));

  const affectedTokens = new Set();

  // You can tune these via env if you want, without touching code.
  const INITIAL_STEP = parseInt(process.env.RPC_LOGS_CHUNK_SIZE || "2000", 10);
  const MIN_STEP = parseInt(process.env.RPC_LOGS_MIN_CHUNK_SIZE || "25", 10);

  try {
    // Query Transfer events (sales from contract)
    const transferFilter = primaryContract.filters.Transfer(primaryAddress, null, null);
    const transfers = await queryFilterChunked(primaryContract, transferFilter, fromBlock, toBlock, {
      initialStep: Number.isFinite(INITIAL_STEP) ? INITIAL_STEP : 2000,
      minStep: Number.isFinite(MIN_STEP) ? MIN_STEP : 25,
      onChunk: ({ from, to, chunkCount }) => {
        console.log(chalk.gray(`  [Catchup] Transfer chunk ${from} → ${to} (${chunkCount} event(s))`));
      },
    });

    for (const event of transfers) {
      const tokenId = Number(event.args.squareNumber);
      affectedTokens.add(tokenId);
      console.log(chalk.blue(`  [Catchup] Transfer: Square ${tokenId} at block ${event.blockNumber}`));
    }

    // Query PersonalizedUnderlay events
    const underlayFilter = underlayContract.filters.PersonalizedUnderlay();
    const underlayEvents = await queryFilterChunked(underlayContract, underlayFilter, fromBlock, toBlock, {
      initialStep: Number.isFinite(INITIAL_STEP) ? INITIAL_STEP : 2000,
      minStep: Number.isFinite(MIN_STEP) ? MIN_STEP : 25,
      onChunk: ({ from, to, chunkCount }) => {
        console.log(chalk.gray(`  [Catchup] Underlay chunk ${from} → ${to} (${chunkCount} event(s))`));
      },
    });

    for (const event of underlayEvents) {
      const tokenId = Number(event.args.squareNumber);
      affectedTokens.add(tokenId);
      console.log(chalk.magenta(`  [Catchup] Underlay: Square ${tokenId} at block ${event.blockNumber}`));
    }

    // Query Personalized events
    const personalizedFilter = primaryContract.filters.Personalized();
    const personalizedEvents = await queryFilterChunked(primaryContract, personalizedFilter, fromBlock, toBlock, {
      initialStep: Number.isFinite(INITIAL_STEP) ? INITIAL_STEP : 2000,
      minStep: Number.isFinite(MIN_STEP) ? MIN_STEP : 25,
      onChunk: ({ from, to, chunkCount }) => {
        console.log(chalk.gray(`  [Catchup] Personalized chunk ${from} → ${to} (${chunkCount} event(s))`));
      },
    });

    for (const event of personalizedEvents) {
      const tokenId = Number(event.args.squareNumber);
      affectedTokens.add(tokenId);
      console.log(chalk.green(`  [Catchup] Personalized: Square ${tokenId} at block ${event.blockNumber}`));
    }

    if (affectedTokens.size > 0) {
      console.log(chalk.yellow(`Found ${affectedTokens.size} affected tokens. Running update...`));
    } else {
      console.log(chalk.green("No missed events found. Up to date!"));
    }

    return affectedTokens;
  } catch (err) {
    console.error(chalk.red(`Error during catch-up: ${err.message}`));
    throw err;
  }
}
