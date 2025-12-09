import { ethers } from "hardhat";
import type { Signer } from "ethers";

import {
  loadSunetEnv,
  selectSunetSignerKey,
  SunetEnv,
} from "./env";

function normalizePrivateKey(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
}

export async function resolvePersonalizerSigner(
  networkName: string,
  sunetEnv?: SunetEnv,
): Promise<Signer> {
  if (networkName === "sunet") {
    const env = sunetEnv ?? loadSunetEnv({ required: true });
    if (!env) {
      throw new Error("Missing SuNet environment.");
    }
    const selectedKey = selectSunetSignerKey(env);
    return new ethers.Wallet(normalizePrivateKey(selectedKey), ethers.provider);
  }

  const [defaultSigner] = await ethers.getSigners();
  if (!defaultSigner) {
    throw new Error("No signer configured for this network.");
  }

  return defaultSigner;
}
