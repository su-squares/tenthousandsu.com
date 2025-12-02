import fs from "fs";
import path from "path";
import dotenv from "dotenv";

export const SUNET_ENV_PATH = path.join(__dirname, "..", "..", "sunet", ".env");
export const SUNET_README_PATH = "nodejs/smart-contract/sunet/README.md";

export type SunetEnv = {
  LOCAL_CHAIN_ID: number;
  RPC_PORT: number;
  BLOCKSCOUT_PORT: number;
  VALIDATOR_PRIVATE_KEY: string;
  BLOCKSCOUT_API_KEY: string;
  rpcUrl: string;
  blockscoutApiUrl: string;
  blockscoutBrowserUrl: string;
};

type LoadOptions = {
  required?: boolean;
};

const requiredKeys = [
  "LOCAL_CHAIN_ID",
  "RPC_PORT",
  "BLOCKSCOUT_PORT",
  "VALIDATOR_PRIVATE_KEY",
] as const;

export function loadSunetEnv(options: LoadOptions = {}): SunetEnv | null {
  const { required = false } = options;

  if (!fs.existsSync(SUNET_ENV_PATH)) {
    if (required) {
      throw new Error(
        `SuNet config missing at ${SUNET_ENV_PATH}. Run pnpm run sunet:setup and read ${SUNET_README_PATH}.`,
      );
    }
    return null;
  }

  const parsed = dotenv.parse(fs.readFileSync(SUNET_ENV_PATH));
  const missing = requiredKeys.filter((key) => !parsed[key]);
  if (missing.length > 0) {
    if (required) {
      throw new Error(
        `SuNet .env is missing: ${missing.join(
          ", ",
        )}. Fill nodejs/smart-contract/sunet/.env and see ${SUNET_README_PATH}.`,
      );
    }
    return null;
  }

  const chainId = Number(parsed.LOCAL_CHAIN_ID);
  const rpcPort = Number(parsed.RPC_PORT);
  const blockscoutPort = Number(parsed.BLOCKSCOUT_PORT);
  const hasInvalidNumber = [chainId, rpcPort, blockscoutPort].some(
    (value) => !Number.isFinite(value),
  );

  if (hasInvalidNumber) {
    if (required) {
      throw new Error(
        `SuNet .env must have numeric LOCAL_CHAIN_ID, RPC_PORT, and BLOCKSCOUT_PORT. See ${SUNET_README_PATH}.`,
      );
    }
    return null;
  }

  return {
    LOCAL_CHAIN_ID: chainId,
    RPC_PORT: rpcPort,
    BLOCKSCOUT_PORT: blockscoutPort,
    VALIDATOR_PRIVATE_KEY: parsed.VALIDATOR_PRIVATE_KEY,
    BLOCKSCOUT_API_KEY: parsed.BLOCKSCOUT_API_KEY ?? "",
    rpcUrl: `http://127.0.0.1:${rpcPort}`,
    blockscoutApiUrl: `http://127.0.0.1:${blockscoutPort}/api`,
    blockscoutBrowserUrl: `http://127.0.0.1:${blockscoutPort}`,
  };
}
