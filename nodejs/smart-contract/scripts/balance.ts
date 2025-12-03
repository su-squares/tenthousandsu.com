import { ethers, network } from "hardhat";

import { readDeployment } from "@script-utils/deployments";
import { SUNET_ENV_PATH, SunetEnv, loadSunetEnv, selectSunetSignerKey } from "@script-utils/env";
import { ensureNetworkIsReachable, ensureSunetReady } from "@script-utils/network";

const OWNER_ENV = "OWNER_ADDRESS";
const LIST_ALL_ENV = "LIST_ALL";
const MAX_LIST_ENV = "MAX_TOKENS_TO_LIST";
const DEFAULT_MAX_LIST = 200;

function summarizeIds(ids: number[]): string {
  if (ids.length === 0) {
    return "none";
  }
  const sorted = [...new Set(ids)].sort((a, b) => a - b);
  const ranges: string[] = [];

  let start = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    if (current === prev + 1) {
      prev = current;
      continue;
    }
    ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = current;
    prev = current;
  }

  ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
  return ranges.join(",");
}

function normalizePrivateKey(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
}

async function resolveViewerAddress(networkName: string, sunetEnv?: SunetEnv): Promise<string> {
  const override = process.env[OWNER_ENV];
  if (override) {
    return ethers.getAddress(override.trim());
  }

  if (networkName === "sunet") {
    const env = sunetEnv ?? loadSunetEnv({ required: true });
    const key = selectSunetSignerKey(env, { required: false });
    if (key) {
      const wallet = new ethers.Wallet(normalizePrivateKey(key), ethers.provider);
      return wallet.getAddress();
    }
  }

  const [defaultSigner] = await ethers.getSigners();
  if (!defaultSigner) {
    throw new Error(
      `No signer available to derive an address. Set ${OWNER_ENV} to the wallet you want to inspect.`,
    );
  }
  return defaultSigner.getAddress();
}

async function main(): Promise<void> {
  const networkName = network.name;

  let sunetEnv: SunetEnv | undefined;
  if (networkName === "sunet") {
    sunetEnv = await ensureSunetReady();
  } else {
    await ensureNetworkIsReachable(networkName);
  }

  const targetAddress = await resolveViewerAddress(networkName, sunetEnv);
  const deployment = readDeployment("primary", networkName);
  if (!deployment?.address) {
    throw new Error(
      `Missing primary deployment for ${networkName}. Deploy it first (pnpm run deploy:${networkName}:primary).`,
    );
  }

  const contract = await ethers.getContractAt("SuMain", deployment.address);

  const balance = await contract.balanceOf(targetAddress);
  const balanceNum = Number(balance);

  console.log(`Network: ${networkName}`);
  console.log(`Contract: ${deployment.address}`);
  console.log(`Owner: ${targetAddress}`);
  console.log(`Balance: ${balanceNum}`);

  if (balanceNum === 0) {
    return;
  }

  const listAll = (process.env[LIST_ALL_ENV] || "").toLowerCase() === "true";
  const parsedMax = Number(process.env[MAX_LIST_ENV]);
  const maxToList = Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : DEFAULT_MAX_LIST;
  const limit = listAll ? balanceNum : Math.min(balanceNum, maxToList);

  const ownedIds: number[] = [];
  for (let i = 0; i < limit; i += 1) {
    const tokenId = await contract.tokenOfOwnerByIndex(targetAddress, i);
    ownedIds.push(Number(tokenId));
  }

  const compressed = summarizeIds(ownedIds);
  console.log(
    `Token ids${balanceNum > limit ? ` (first ${limit} of ${balanceNum})` : ""}: ${compressed}`,
  );
  if (balanceNum > limit && !listAll) {
    console.log(
      `Set ${LIST_ALL_ENV}=true or ${MAX_LIST_ENV} to a higher number to list more token ids.`,
    );
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
