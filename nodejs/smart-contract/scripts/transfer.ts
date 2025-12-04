import { ethers, network } from "hardhat";

import { readDeployment } from "@script-utils/deployments";
import {
  SunetEnv,
  loadSunetEnv,
  loadTransferEnv,
  selectSunetSignerKey,
} from "@script-utils/env";
import { ensureNetworkIsReachable, ensureSunetReady } from "@script-utils/network";

const PRIVATE_KEY_OVERRIDE_ENV = "TRANSFER_PRIVATE_KEY";

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

async function main(): Promise<void> {
  const transferEnv = loadTransferEnv({ required: true });
  if (!transferEnv) {
    throw new Error("Transfer env could not be loaded.");
  }
  const { tokenId, recipient, unsafeTransfer } = transferEnv;

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

  const { owner, approved, isOperator } = await resolveTransferPermissions(contract, tokenId, signerAddress);

  const transferKind = unsafeTransfer ? "transferFrom" : "safeTransferFrom";
  console.log("===== NFT TRANSFER =====");
  console.log(`Network: ${networkName}`);
  console.log(`Contract: ${deployment.address}`);
  console.log(`Token id: ${tokenId}`);
  console.log(`Recipient: ${recipient}`);
  console.log(`Current owner: ${owner}`);
  console.log(
    `Signer: ${signerAddress}${
      owner.toLowerCase() === signerAddress.toLowerCase()
        ? " (owner)"
        : approved.toLowerCase() === signerAddress.toLowerCase()
          ? " (approved address)"
          : isOperator
            ? " (approved operator)"
            : ""
    }`,
  );
  console.log(`Method: ${transferKind}${unsafeTransfer ? " (unsafe, no ERC721 receiver check)" : ""}`);
  console.log("========================");

  const tx = unsafeTransfer
    ? await contract.transferFrom(owner, recipient, tokenId)
    : await contract["safeTransferFrom(address,address,uint256)"](owner, recipient, tokenId);
  const receipt = await tx.wait();

  console.log(`Transfer submitted. Tx hash: ${receipt?.hash ?? tx.hash}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
