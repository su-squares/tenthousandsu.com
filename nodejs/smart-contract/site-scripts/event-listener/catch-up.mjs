/**
 * Historical event catch-up module.
 * Queries past events that occurred while the listener was offline.
 */
import chalk from "chalk";

// ============================================================================
// Historical Event Catch-up
// ============================================================================

export async function catchUpMissedEvents(provider, contracts, fromBlock, toBlock) {
  const { primaryContract, underlayContract, primaryAddress } = contracts;

  console.log(chalk.yellow(`\nCatching up on events from block ${fromBlock} to ${toBlock}...`));

  const affectedTokens = new Set();

  try {
    // Query Transfer events (sales from contract)
    const transferFilter = primaryContract.filters.Transfer(primaryAddress, null, null);
    const transfers = await primaryContract.queryFilter(transferFilter, fromBlock, toBlock);

    for (const event of transfers) {
      const tokenId = Number(event.args.squareNumber);
      affectedTokens.add(tokenId);
      console.log(chalk.blue(`  [Catchup] Transfer: Square ${tokenId} at block ${event.blockNumber}`));
    }

    // Query PersonalizedUnderlay events
    const underlayFilter = underlayContract.filters.PersonalizedUnderlay();
    const underlayEvents = await underlayContract.queryFilter(underlayFilter, fromBlock, toBlock);

    for (const event of underlayEvents) {
      const tokenId = Number(event.args.squareNumber);
      affectedTokens.add(tokenId);
      console.log(chalk.magenta(`  [Catchup] Underlay: Square ${tokenId} at block ${event.blockNumber}`));
    }

    // Query Personalized events
    const personalizedFilter = primaryContract.filters.Personalized();
    const personalizedEvents = await primaryContract.queryFilter(personalizedFilter, fromBlock, toBlock);

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
