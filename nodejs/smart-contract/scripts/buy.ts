import { ethers, network } from "hardhat";
import { ContractTransactionResponse } from "ethers";

import { readDeployment } from "@script-utils/deployments";
import { SUNET_ENV_PATH, SunetEnv, loadSunetEnv, selectSunetSignerKey } from "@script-utils/env";
import { ensureNetworkIsReachable, ensureSunetReady } from "@script-utils/network";

const TOKEN_INPUT_ENV = "BUY_TOKENS";
const DEFAULT_TOKEN_ID = 1;

// Gas estimation buffer (20% extra for safety)
const GAS_BUFFER_PERCENT = 20n;

// Tuning parameters
const SEND_BATCH_SIZE = Number(process.env.SEND_BATCH_SIZE) || 500;
const SEND_DELAY_MS = Number(process.env.SEND_DELAY_MS) || 10;
const CONFIRM_BATCH_SIZE = Number(process.env.CONFIRM_BATCH_SIZE) || 200;
const PROGRESS_INTERVAL = 1000;

function normalizePrivateKey(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
}

function expandRange(input: string): number[] {
  const ids: number[] = [];
  const parts = input.split(",").map((p) => p.trim()).filter(Boolean);
  
  for (const part of parts) {
    const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      for (let i = start; i <= end; i++) {
        ids.push(i);
      }
    } else {
      ids.push(Number(part));
    }
  }
  return ids;
}

function summarizeIds(ids: number[]): string {
  if (ids.length === 0) return "none";
  if (ids.length <= 10) return ids.join(", ");
  return `${ids.slice(0, 5).join(", ")} ... ${ids.slice(-3).join(", ")} (${ids.length} total)`;
}

async function resolveBuyerSigner(networkName: string, sunetEnv?: SunetEnv) {
  if (networkName === "sunet") {
    const env = sunetEnv ?? loadSunetEnv({ required: true });
    const selectedKey = selectSunetSignerKey(env);
    return new ethers.Wallet(normalizePrivateKey(selectedKey), ethers.provider);
  }

  const overrideKey = process.env.BUYER_PRIVATE_KEY;
  if (overrideKey) {
    return new ethers.Wallet(normalizePrivateKey(overrideKey), ethers.provider);
  }

  const [defaultSigner] = await ethers.getSigners();
  if (!defaultSigner) {
    throw new Error("No signer configured for this network.");
  }
  return defaultSigner;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verifyContractExists(address: string): Promise<void> {
  const code = await ethers.provider.getCode(address);
  if (code === "0x" || code === "0x0" || code.length <= 2) {
    throw new Error(
      `No contract found at ${address}. Deploy the contract first (pnpm run deploy:sunet:primary).`
    );
  }
}

async function estimateGasForPurchase(
  contract: Awaited<ReturnType<typeof ethers.getContractAt>>,
  tokenId: number,
  value: bigint
): Promise<bigint> {
  try {
    const estimated = await contract.purchase.estimateGas(tokenId, { value });
    // Add buffer for safety
    const withBuffer = estimated + (estimated * GAS_BUFFER_PERCENT) / 100n;
    return withBuffer;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to estimate gas for purchase(${tokenId}): ${errMsg}`);
  }
}

async function findAvailableTokenForEstimation(
  contract: Awaited<ReturnType<typeof ethers.getContractAt>>,
  tokenIds: number[]
): Promise<number> {
  // Try to find an available token to estimate gas
  // Check first few tokens, then sample from the list
  const samplesToCheck = [
    ...tokenIds.slice(0, 5),
    ...tokenIds.filter((_, i) => i % 100 === 0).slice(0, 5)
  ];
  
  for (const tokenId of samplesToCheck) {
    try {
      // Check if token is available (not already owned)
      const owner = await contract.ownerOf(tokenId);
      // If we get here without error, token exists and is owned
      continue;
    } catch {
      // Token doesn't exist yet = available for purchase
      return tokenId;
    }
  }
  
  // Fall back to first token in list
  return tokenIds[0];
}

async function main(): Promise<void> {
  const networkName = network.name;
  const tokenInputRaw = process.env[TOKEN_INPUT_ENV] ?? String(DEFAULT_TOKEN_ID);

  let sunetEnv: SunetEnv | undefined;
  if (networkName === "sunet") {
    sunetEnv = await ensureSunetReady();
  } else {
    await ensureNetworkIsReachable(networkName);
  }

  const deployment = readDeployment("primary", networkName);
  if (!deployment?.address) {
    throw new Error(`Missing primary deployment for ${networkName}.`);
  }

  // Verify contract exists BEFORE doing anything else
  console.log(`\nVerifying contract at ${deployment.address}...`);
  await verifyContractExists(deployment.address);
  console.log(`Contract verified ✓`);

  const buyer = await resolveBuyerSigner(networkName, sunetEnv);
  const buyerAddress = await buyer.getAddress();
  const contract = await ethers.getContractAt("SuMain", deployment.address, buyer);
  const salePriceWei = await contract.salePrice();

  const tokenIds = expandRange(tokenInputRaw);
  const totalCostWei = salePriceWei * BigInt(tokenIds.length);
  const buyerBalance = await ethers.provider.getBalance(buyerAddress);

  // Estimate gas ONCE at the start using an available token
  console.log(`Estimating gas for purchase()...`);
  const sampleToken = await findAvailableTokenForEstimation(contract, tokenIds);
  const gasLimit = await estimateGasForPurchase(contract, sampleToken, salePriceWei);
  console.log(`Gas estimate: ${gasLimit} (includes ${GAS_BUFFER_PERCENT}% buffer) ✓`);

  console.log(`\n========== BULK BUY CONFIGURATION ==========`);
  console.log(`Network: ${networkName}`);
  console.log(`Contract: ${deployment.address}`);
  console.log(`Buyer: ${buyerAddress}`);
  console.log(`Tokens to buy: ${summarizeIds(tokenIds)}`);
  console.log(`Total tokens: ${tokenIds.length}`);
  console.log(`Price per token: ${ethers.formatEther(salePriceWei)} ETH`);
  console.log(`Total cost: ${ethers.formatEther(totalCostWei)} ETH`);
  console.log(`Buyer balance: ${ethers.formatEther(buyerBalance)} ETH`);
  console.log(`Gas limit per tx: ${gasLimit}`);
  console.log(`Send batch size: ${SEND_BATCH_SIZE}`);
  console.log(`Send delay: ${SEND_DELAY_MS}ms`);
  console.log(`=============================================\n`);

  if (buyerBalance < totalCostWei) {
    throw new Error(
      `Insufficient balance: have ${ethers.formatEther(buyerBalance)} ETH, need ${ethers.formatEther(totalCostWei)} ETH`
    );
  }

  // Get starting nonce
  let nonce = await ethers.provider.getTransactionCount(buyerAddress, "pending");
  console.log(`Starting nonce: ${nonce}`);

  // Phase 1: Send all transactions (don't wait for receipts)
  console.log(`\n[Phase 1] Sending ${tokenIds.length} transactions...`);
  const startTime = Date.now();
  
  type PendingTx = {
    tokenId: number;
    tx: ContractTransactionResponse;
    nonce: number;
  };
  
  const pendingTxs: PendingTx[] = [];
  const sendFailures: Array<{ tokenId: number; error: string }> = [];

  for (let i = 0; i < tokenIds.length; i++) {
    const tokenId = tokenIds[i];
    
    try {
      // Send transaction with explicit nonce AND pre-calculated gas limit
      const tx = await contract.purchase(tokenId, {
        value: salePriceWei,
        nonce: nonce,
        gasLimit: gasLimit,
      });
      
      pendingTxs.push({ tokenId, tx, nonce });
      nonce++;
      
      if ((i + 1) % PROGRESS_INTERVAL === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const rate = ((i + 1) / parseFloat(elapsed)).toFixed(1);
        console.log(`  Sent ${i + 1}/${tokenIds.length} txs (${elapsed}s, ${rate} tx/s)`);
      }
      
      // Small delay between batches to avoid overwhelming the node
      if ((i + 1) % SEND_BATCH_SIZE === 0 && i < tokenIds.length - 1) {
        await sleep(SEND_DELAY_MS);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      sendFailures.push({ tokenId, error: errMsg.slice(0, 100) });
      // Don't increment nonce on failure - the tx wasn't sent
    }
  }

  const sendElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const sendRate = (pendingTxs.length / parseFloat(sendElapsed)).toFixed(1);
  console.log(`\n[Phase 1 Complete] Sent ${pendingTxs.length} txs in ${sendElapsed}s (${sendRate} tx/s)`);
  if (sendFailures.length > 0) {
    console.log(`  Send failures: ${sendFailures.length}`);
  }

  // Phase 2: Wait for confirmations
  console.log(`\n[Phase 2] Waiting for ${pendingTxs.length} confirmations...`);
  const confirmStartTime = Date.now();
  
  const successes: number[] = [];
  const confirmFailures: Array<{ tokenId: number; error: string }> = [];

  // Process in batches to avoid memory issues
  for (let i = 0; i < pendingTxs.length; i += CONFIRM_BATCH_SIZE) {
    const batch = pendingTxs.slice(i, i + CONFIRM_BATCH_SIZE);
    
    const results = await Promise.allSettled(
      batch.map(async ({ tokenId, tx }) => {
        const receipt = await tx.wait();
        if (receipt?.status === 1) {
          return tokenId;
        }
        throw new Error("Transaction reverted");
      })
    );
    
    results.forEach((result, idx) => {
      const { tokenId } = batch[idx];
      if (result.status === "fulfilled") {
        successes.push(result.value);
      } else {
        const errMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
        confirmFailures.push({ tokenId, error: errMsg.slice(0, 100) });
      }
    });
    
    const confirmed = i + batch.length;
    const elapsed = ((Date.now() - confirmStartTime) / 1000).toFixed(1);
    const rate = (confirmed / parseFloat(elapsed)).toFixed(1);
    console.log(`  Confirmed ${confirmed}/${pendingTxs.length} (${elapsed}s, ${rate} tx/s)`);
  }

  // Final summary
  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const overallRate = (successes.length / parseFloat(totalElapsed)).toFixed(1);
  
  console.log(`\n========== RESULTS ==========`);
  console.log(`Total time: ${totalElapsed}s`);
  console.log(`Overall rate: ${overallRate} tx/s`);
  console.log(`Successful purchases: ${successes.length}/${tokenIds.length}`);
  console.log(`Send failures: ${sendFailures.length}`);
  console.log(`Confirmation failures: ${confirmFailures.length}`);
  
  if (successes.length > 0) {
    console.log(`\nPurchased tokens: ${summarizeIds(successes.sort((a, b) => a - b))}`);
  }
  
  if (sendFailures.length > 0 && sendFailures.length <= 20) {
    console.log(`\nSend failures:`);
    sendFailures.forEach(({ tokenId, error }) => {
      console.log(`  Token ${tokenId}: ${error}`);
    });
  }
  
  if (confirmFailures.length > 0 && confirmFailures.length <= 20) {
    console.log(`\nConfirmation failures:`);
    confirmFailures.forEach(({ tokenId, error }) => {
      console.log(`  Token ${tokenId}: ${error}`);
    });
  }

  // Exit with error code if any failures
  if (sendFailures.length > 0 || confirmFailures.length > 0) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
