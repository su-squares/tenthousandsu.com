/**
 * Event handlers module.
 * Sets up event listeners on contracts and feeds events to the accumulator.
 */
import chalk from "chalk";

// ============================================================================
// Event Listener Setup
// ============================================================================

export function setupEventListeners(primaryContract, underlayContract, primaryAddress, accumulator) {
  // Transfer events (only sales from contract)
  primaryContract.on("Transfer", (from, to, tokenId, eventLog) => {
    if (from.toLowerCase() === primaryAddress.toLowerCase()) {
      console.log(chalk.blue(`[Event] Transfer: Square ${tokenId} sold at block ${eventLog.log.blockNumber}`));
      accumulator.addEvent(Number(tokenId), eventLog.log.blockNumber);
    }
  });

  // Personalized events (primary contract)
  primaryContract.on("Personalized", (squareNumber, eventLog) => {
    console.log(chalk.green(`[Event] Personalized: Square ${squareNumber} at block ${eventLog.log.blockNumber}`));
    accumulator.addEvent(Number(squareNumber), eventLog.log.blockNumber);
  });

  // PersonalizedUnderlay events
  underlayContract.on("PersonalizedUnderlay", (squareNumber, rgbData, title, href, eventLog) => {
    console.log(chalk.magenta(`[Event] Underlay: Square ${squareNumber} at block ${eventLog.log.blockNumber}`));
    accumulator.addEvent(Number(squareNumber), eventLog.log.blockNumber);
  });

  console.log(chalk.cyan("✓ Event listeners active"));
}
