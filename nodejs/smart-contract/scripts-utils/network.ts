import { ethers, network } from "hardhat";

import {
  SUNET_ENV_PATH,
  SUNET_README_PATH,
  SunetEnv,
  loadSunetEnv,
} from "./env";

export function requireSunetEnv(): SunetEnv {
  const env = loadSunetEnv({ required: true });
  if (!env) {
    throw new Error(
      `SuNet .env.sunet is missing or empty. Run pnpm run sunet:setup and read ${SUNET_README_PATH}.`,
    );
  }
  return env;
}

export async function ensureNetworkIsReachable(
  networkName: string,
  sunetEnv?: SunetEnv,
): Promise<void> {
  try {
    await ethers.provider.getBlockNumber();
  } catch (error) {
    if (networkName === "sunet") {
      const rpc = sunetEnv?.rpcUrl ?? "http://127.0.0.1:8545";
      throw new Error(
        `Cannot reach SuNet RPC at ${rpc}. Ensure the network is running (pnpm run sunet:start) and that ${SUNET_ENV_PATH} points at the right chain id and port. Read ${SUNET_README_PATH} for setup. ${(error as Error).message}`,
      );
    }
    throw new Error(
      `Unable to reach ${networkName} RPC. Check your RPC URL and account key env vars. ${(error as Error).message}`,
    );
  }
}

export async function ensureSunetReady(): Promise<SunetEnv> {
  if (network.name !== "sunet") {
    throw new Error(
      "ensureSunetReady() was called outside the sunet network. Use ensureNetworkIsReachable instead.",
    );
  }

  const env = requireSunetEnv();
  await ensureNetworkIsReachable("sunet", env);

  const onChain = await ethers.provider.getNetwork();
  const chainId = Number(onChain.chainId);
  if (chainId !== env.LOCAL_CHAIN_ID) {
    throw new Error(
      `Connected to chain id ${chainId} but ${SUNET_ENV_PATH} expects ${env.LOCAL_CHAIN_ID}. Make sure your SuNet node is running on the same chain id and port. See ${SUNET_README_PATH}.`,
    );
  }

  return env;
}
