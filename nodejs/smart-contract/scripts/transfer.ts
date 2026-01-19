import chalk from "chalk";
import { ContractTransactionResponse } from "ethers";
import { ethers, network } from "hardhat";

import { readDeployment } from "@script-utils/deployments";
import {
  SunetEnv,
  loadSunetEnv,
  loadTransferEnv,
  selectSunetSignerKey,
} from "@script-utils/env";
import { ensureNetworkIsReachable, ensureSunetReady } from "@script-utils/network";
import { summarizeTokenIds } from "@script-utils/token-input";

const PRIVATE_KEY_OVERRIDE_ENV = "TRANSFER_PRIVATE_KEY";

const SEND_BATCH_SIZE = Number(process.env.SEND_BATCH_SIZE) || 500;
const SEND_DELAY_MS = Number(process.env.SEND_DELAY_MS) || 10;
const CONFIRM_BATCH_SIZE = Number(process.env.CONFIRM_BATCH_SIZE) || 200;
const PROGRESS_INTERVAL = 1000;

function normalizePrivateKey(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
}

async function resolveSenderSigner(networkName: string, sunetEnv?: SunetEnv) {
  if (networkName === "sunet") {
    const env = sunetEnv ?? loadSunetEnv({ required: true });
    const selectedKey = selectSunetSignerKey(env);
    return new ethers.Wallet(normalizePrivateKey(selectedKey), ethers.provider);
  }

  const overrideKey = process.env[PRIVATE_KEY_OVERRIDE_ENV];
  if (overrideKey) {
    return new ethers.Wallet(normalizePrivateKey(overrideKey), ethers.provider);
  }

  const [defaultSigner] = await ethers.getSigners();
  if (!defaultSigner) {
    throw new Error("No signer configured for this network.");
  }
  return defaultSigner;
}

async function resolveTransferPermissions(
  contract: Awaited<ReturnType<typeof ethers.getContractAt>>,
  tokenId: number,
  senderAddress: string,
): Promise<{
  owner: string;
  approved: string;
  isOperator: boolean;
}> {
  let owner: string;
  try {
    owner = await contract.ownerOf(tokenId);
  } catch (error) {
    throw new Error(`Unable to read owner for token ${tokenId}: ${(error as Error).message}`);
  }

  const normalizedOwner = ethers.getAddress(owner);
  const normalizedSender = ethers.getAddress(senderAddress);
  const senderLower = normalizedSender.toLowerCase();

  const approvedRaw = await contract.getApproved(tokenId).catch(() => ethers.ZeroAddress);
  const approved = ethers.getAddress(approvedRaw);
  const isOperator =
    (await contract.isApprovedForAll(normalizedOwner, normalizedSender).catch(() => false)) || false;

  const canTransfer =
    normalizedOwner.toLowerCase() === senderLower ||
    approved.toLowerCase() === senderLower ||
    isOperator;

  if (!canTransfer) {
    throw new Error(
      `Token ${tokenId} belongs to ${normalizedOwner}. ${normalizedSender} is not the owner, approved address, or operator.`,
    );
  }

  return { owner: normalizedOwner, approved, isOperator };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const transferEnv = loadTransferEnv({ required: true });
  if (!transferEnv) {
    throw new Error("Transfer env could not be loaded.");
  }
  const { tokenIds, recipient, unsafeTransfer } = transferEnv;

  const networkName = network.name;

  let sunetEnv: SunetEnv | undefined;
  if (networkName === "sunet") {
    sunetEnv = await ensureSunetReady();
  } else {
    await ensureNetworkIsReachable(networkName);
  }

  const deployment = readDeployment("primary", networkName);
  if (!deployment?.address) {
    throw new Error(
      `Missing primary deployment for ${networkName}. Deploy the contract first (pnpm run deploy:${networkName}:primary).`,
    );
  }

  const signer = await resolveSenderSigner(networkName, sunetEnv);
  const signerAddress = await signer.getAddress();
  const contract = await ethers.getContractAt("SuMain", deployment.address, signer);

  const transferKind = unsafeTransfer ? "transferFrom" : "safeTransferFrom";
  console.log(chalk.cyan(`\nNFT transfer on ${chalk.bold(networkName)}`));
  console.log(`Contract: ${chalk.bold(deployment.address)}`);
  console.log(`Recipient: ${chalk.bold(recipient)}`);
  console.log(`Token ids: ${summarizeTokenIds(tokenIds)}`);
  console.log(`Signer: ${chalk.bold(signerAddress)}`);
  console.log(`Method: ${transferKind}${unsafeTransfer ? " (unsafe, no ERC721 receiver check)" : ""}`);
  console.log(chalk.gray(`Send batch size: ${SEND_BATCH_SIZE}`));
  console.log(chalk.gray(`Send delay: ${SEND_DELAY_MS}ms`));
  console.log(chalk.gray(`Confirm batch size: ${CONFIRM_BATCH_SIZE}`));
  console.log(chalk.cyan("==================================="));

  let nonce = await ethers.provider.getTransactionCount(signerAddress, "pending");
  console.log(chalk.gray(`Starting nonce: ${nonce}`));

  console.log(chalk.cyan(`\n[Phase 1] Sending ${tokenIds.length} transfers...`));
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
      const { owner } = await resolveTransferPermissions(contract, tokenId, signerAddress);

      const tx = unsafeTransfer
        ? await contract.transferFrom(owner, recipient, tokenId, { nonce })
        : await contract["safeTransferFrom(address,address,uint256)"](owner, recipient, tokenId, {
            nonce,
          });

      pendingTxs.push({ tokenId, tx, nonce });
      nonce++;

      if ((i + 1) % PROGRESS_INTERVAL === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const rate = ((i + 1) / parseFloat(elapsed)).toFixed(1);
        console.log(chalk.gray(`  Sent ${i + 1}/${tokenIds.length} (${elapsed}s, ${rate} tx/s)`));
      }

      if ((i + 1) % SEND_BATCH_SIZE === 0 && i < tokenIds.length - 1) {
        await sleep(SEND_DELAY_MS);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`Token ${tokenId} send failed: ${errMsg}`));
      sendFailures.push({ tokenId, error: errMsg });
    }
  }

  const sendElapsedSec = (Date.now() - startTime) / 1000;
  const sendElapsed = sendElapsedSec.toFixed(1);
  const sendRate = (pendingTxs.length / Math.max(sendElapsedSec, 0.1)).toFixed(1);
  console.log(
    chalk.cyan(
      `\n[Phase 1 Complete] Sent ${pendingTxs.length} txs in ${sendElapsed}s (${sendRate} tx/s)`,
    ),
  );
  if (sendFailures.length > 0) {
    console.log(chalk.yellow(`Send failures: ${sendFailures.length}`));
  }

  console.log(chalk.cyan(`\n[Phase 2] Waiting for ${pendingTxs.length} confirmations...`));
  const confirmStartTime = Date.now();

  const successes: number[] = [];
  const confirmFailures: Array<{ tokenId: number; error: string }> = [];

  for (let i = 0; i < pendingTxs.length; i += CONFIRM_BATCH_SIZE) {
    const batch = pendingTxs.slice(i, i + CONFIRM_BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async ({ tokenId, tx }) => {
        const receipt = await tx.wait();
        if (receipt?.status === 1) {
          return tokenId;
        }
        throw new Error("Transaction reverted");
      }),
    );

    results.forEach((result, idx) => {
      const { tokenId } = batch[idx];
      if (result.status === "fulfilled") {
        successes.push(result.value);
      } else {
        const errMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
        confirmFailures.push({ tokenId, error: errMsg.slice(0, 120) });
      }
    });

    const confirmed = i + batch.length;
    const elapsedSec = (Date.now() - confirmStartTime) / 1000;
    const elapsed = elapsedSec.toFixed(1);
    const rate = (confirmed / Math.max(elapsedSec, 0.1)).toFixed(1);
    console.log(chalk.gray(`  Confirmed ${confirmed}/${pendingTxs.length} (${elapsed}s, ${rate} tx/s)`));
  }

  const totalElapsedSec = (Date.now() - startTime) / 1000;
  const totalElapsed = totalElapsedSec.toFixed(1);
  const overallRate = (successes.length / Math.max(totalElapsedSec, 0.1)).toFixed(1);

  console.log(chalk.cyan("\n========== RESULTS =========="));
  console.log(`Total time: ${totalElapsed}s`);
  console.log(`Overall rate: ${overallRate} tx/s`);
  console.log(`Successful transfers: ${successes.length}/${tokenIds.length}`);
  console.log(`Send failures: ${sendFailures.length}`);
  console.log(`Confirmation failures: ${confirmFailures.length}`);

  if (successes.length > 0) {
    const sortedSuccesses = [...successes].sort((a, b) => a - b);
    console.log(chalk.green(`Transferred tokens: ${summarizeTokenIds(sortedSuccesses)}`));
  }

  if (sendFailures.length > 0 && sendFailures.length <= 20) {
    console.log(chalk.red("\nSend failures:"));
    sendFailures.forEach(({ tokenId, error }) => {
      console.log(chalk.red(`  Token ${tokenId}: ${error}`));
    });
  }

  if (confirmFailures.length > 0 && confirmFailures.length <= 20) {
    console.log(chalk.red("\nConfirmation failures:"));
    confirmFailures.forEach(({ tokenId, error }) => {
      console.log(chalk.red(`  Token ${tokenId}: ${error}`));
    });
  }

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
