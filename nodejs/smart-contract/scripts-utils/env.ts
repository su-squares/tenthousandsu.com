import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { getAddress, isAddress, parseEther } from "ethers";
import { expandTokenRange } from "./token-input";

export const CONTRACT_ENV_PATH = path.join(__dirname, "..", ".env.contract");
export const CONTRACT_ENV_EXAMPLE_PATH = "nodejs/smart-contract/.env.contract.example";
export const SUNET_ENV_PATH = path.join(__dirname, "..", "sunet", ".env.sunet");
export const SUNET_README_PATH = "nodejs/smart-contract/sunet/README.md";

export type ContractEnv = {
  CEO_ADDRESS: string;
  CFO_ADDRESS: string;
  COO_ADDRESS: string;
  CEO_ADDRESS_UNDERLAY?: string;
  CFO_ADDRESS_UNDERLAY?: string;
};

export type SunetEnv = {
  LOCAL_CHAIN_ID: number;
  RPC_PORT: number;
  BLOCKSCOUT_PORT: number;
  VALIDATOR_PRIVATE_KEY: string;
  VALIDATOR_ACCOUNT_BALANCE?: string;
  BLOCKSCOUT_API_KEY: string;
  TEST_ACCOUNT?: string;
  TEST_ACCOUNT_PRIVATE_KEY?: string;
  TEST_ACCOUNT_BALANCE?: string;
  rpcUrl: string;
  blockscoutApiUrl: string;
  blockscoutBrowserUrl: string;
};

export type TransferEnv = {
  tokenIds: number[];
  recipient: string;
  unsafeTransfer: boolean;
};

export type ContractPricingEnv = {
  salePriceWei: bigint;
  promoCreationLimit: bigint;
  personalizationPriceWei: bigint;
  underlayPersonalizationPriceWei: bigint;
};

type TokenUriBaseOptions = {
  allowEmpty?: boolean;
};

type LoadOptions = {
  required?: boolean;
  requireKeys?: (keyof ContractEnv)[];
};

const contractRequiredKeys = ["CEO_ADDRESS", "CFO_ADDRESS", "COO_ADDRESS"] as const;

const sunetRequiredKeys = [
  "LOCAL_CHAIN_ID",
  "RPC_PORT",
  "BLOCKSCOUT_PORT",
  "VALIDATOR_PRIVATE_KEY",
] as const;

const DEFAULT_SALE_PRICE_ETH = "0.5";
const DEFAULT_PROMO_CREATION_LIMIT = 5000;
const DEFAULT_PERSONALIZATION_PRICE_ETH = "0.01";
const DEFAULT_UNDERLAY_PERSONALIZATION_PRICE_ETH = "0.001";

export function loadTransferEnv(options: { required?: boolean } = {}): TransferEnv | null {
  const { required = true } = options;
  const tokenInputRaw = (process.env.TRANSFER_TOKENID || "").trim();
  const recipientRaw = (process.env.RECIPIENT_ADDRESS || "").trim();
  const unsafeRaw = (process.env.UNSAFE_TRANSFER || "").trim().toLowerCase();

  const missing: string[] = [];
  if (!tokenInputRaw) {
    missing.push("TRANSFER_TOKENID");
  }
  if (!recipientRaw) {
    missing.push("RECIPIENT_ADDRESS");
  }

  if (missing.length > 0) {
    if (required) {
      throw new Error(
        `Missing env vars: ${missing.join(", ")}. Set them in ${CONTRACT_ENV_PATH} (see ${CONTRACT_ENV_EXAMPLE_PATH}).`,
      );
    }
    return null;
  }

  let tokenIds: number[];
  try {
    tokenIds = expandTokenRange(tokenInputRaw, "TRANSFER_TOKENID");
  } catch (error) {
    if (required) {
      throw error;
    }
    return null;
  }

  if (tokenIds.length === 0) {
    if (required) {
      throw new Error("TRANSFER_TOKENID must include at least one token id.");
    }
    return null;
  }

  if (!isAddress(recipientRaw)) {
    if (required) {
      throw new Error("RECIPIENT_ADDRESS must be a valid 0x-prefixed address.");
    }
    return null;
  }

  return {
    tokenIds,
    recipient: getAddress(recipientRaw),
    unsafeTransfer: ["true", "1", "yes", "y", "on"].includes(unsafeRaw),
  };
}

export type TokenCheckEnv = {
  tokenId: number;
};

export function loadTokenCheckEnv(options: { required?: boolean } = {}): TokenCheckEnv | null {
  const { required = false } = options;
  const rawTokenId = (process.env.TOKEN_ID_CHECK || "").trim();

  if (!rawTokenId) {
    if (required) {
      throw new Error(
        `Missing env var TOKEN_ID_CHECK. Set it in ${CONTRACT_ENV_PATH} (see ${CONTRACT_ENV_EXAMPLE_PATH}).`,
      );
    }
    return null;
  }

  const tokenId = Number(rawTokenId);
  if (!Number.isInteger(tokenId) || tokenId <= 0) {
    throw new Error("TOKEN_ID_CHECK must be a positive integer.");
  }

  return { tokenId };
}

export function loadContractEnv(options: LoadOptions = {}): ContractEnv | null {
  const { required = false, requireKeys = contractRequiredKeys } = options;

  const hasFile = fs.existsSync(CONTRACT_ENV_PATH);
  const source: Record<string, string | undefined> = hasFile
    ? dotenv.parse(fs.readFileSync(CONTRACT_ENV_PATH))
    : process.env;

  const missing = requireKeys.filter((key) => !(source[key] || "").trim());
  if (missing.length > 0) {
    if (required) {
      throw new Error(
        `Missing env vars: ${missing.join(
          ", ",
        )}. Copy ${CONTRACT_ENV_EXAMPLE_PATH} to ${CONTRACT_ENV_PATH} and set the needed value(s).`,
      );
    }
    return null;
  }

  const env: ContractEnv = {
    CEO_ADDRESS: (source.CEO_ADDRESS || "").trim(),
    CFO_ADDRESS: (source.CFO_ADDRESS || "").trim(),
    COO_ADDRESS: (source.COO_ADDRESS || "").trim(),
    CEO_ADDRESS_UNDERLAY: (source.CEO_ADDRESS_UNDERLAY || "").trim(),
    CFO_ADDRESS_UNDERLAY: (source.CFO_ADDRESS_UNDERLAY || "").trim(),
  };

  const invalid = requireKeys.filter((key) => !isAddress(env[key] ?? ""));

  if (invalid.length > 0) {
    if (required) {
      throw new Error(
        `Contract env has invalid addresses for: ${invalid.join(
          ", ",
        )}. Ensure they are 0x-prefixed addresses in ${CONTRACT_ENV_PATH}.`,
      );
    }
    return null;
  }

  return env;
}

export function resolveTokenUriBase(networkName: string, options: TokenUriBaseOptions = {}): string {
  const { allowEmpty = false } = options;
  const upper = (networkName || "mainnet").toUpperCase();
  const key = `TOKEN_URI_BASE_${upper}`;
  const raw = (process.env[key] || process.env.TOKEN_URI_BASE || "").trim();
  if (raw) {
    return raw.endsWith("/") ? raw : `${raw}/`;
  }
  if (upper === "MAINNET") {
    return "https://tenthousandsu.com/erc721/";
  }
  if (allowEmpty) {
    return "";
  }
  throw new Error(
    `TOKEN_URI_BASE not set for ${networkName}. Add ${key} to ${CONTRACT_ENV_PATH} (see ${CONTRACT_ENV_EXAMPLE_PATH}).`,
  );
}

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
  const missing = sunetRequiredKeys.filter((key) => !parsed[key]);
  if (missing.length > 0) {
    if (required) {
      throw new Error(
        `SuNet .env.sunet is missing: ${missing.join(
          ", ",
        )}. Fill nodejs/smart-contract/sunet/.env.sunet and see ${SUNET_README_PATH}.`,
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
        `SuNet .env.sunet must have numeric LOCAL_CHAIN_ID, RPC_PORT, and BLOCKSCOUT_PORT. See ${SUNET_README_PATH}.`,
      );
    }
    return null;
  }

  return {
    LOCAL_CHAIN_ID: chainId,
    RPC_PORT: rpcPort,
    BLOCKSCOUT_PORT: blockscoutPort,
    VALIDATOR_PRIVATE_KEY: parsed.VALIDATOR_PRIVATE_KEY,
    VALIDATOR_ACCOUNT_BALANCE: parsed.VALIDATOR_ACCOUNT_BALANCE?.trim(),
    BLOCKSCOUT_API_KEY: parsed.BLOCKSCOUT_API_KEY ?? "",
    TEST_ACCOUNT: parsed.TEST_ACCOUNT?.trim(),
    TEST_ACCOUNT_PRIVATE_KEY: parsed.TEST_ACCOUNT_PRIVATE_KEY?.trim(),
    TEST_ACCOUNT_BALANCE: parsed.TEST_ACCOUNT_BALANCE?.trim(),
    rpcUrl: `http://127.0.0.1:${rpcPort}`,
    blockscoutApiUrl: `http://127.0.0.1:${blockscoutPort}/api`,
    blockscoutBrowserUrl: `http://127.0.0.1:${blockscoutPort}`,
  };
}

export function loadContractPricingEnv(): ContractPricingEnv {
  const hasFile = fs.existsSync(CONTRACT_ENV_PATH);
  const source: Record<string, string | undefined> = hasFile
    ? dotenv.parse(fs.readFileSync(CONTRACT_ENV_PATH))
    : process.env;

  const salePriceRaw = (source.SALE_PRICE_ETH || "").trim();
  const promoLimitRaw = (source.PROMO_CREATION_LIMIT || "").trim();
  const personalizationRaw = (source.PERSONALIZATION_PRICE_ETH || "").trim();

  let salePriceWei: bigint;
  try {
    salePriceWei = parseEther(salePriceRaw || DEFAULT_SALE_PRICE_ETH);
  } catch (error) {
    throw new Error(
      `Invalid SALE_PRICE_ETH value${hasFile ? ` in ${CONTRACT_ENV_PATH}` : ""}. Use a numeric ETH amount (e.g. ${DEFAULT_SALE_PRICE_ETH}).`,
    );
  }
  if (salePriceWei <= 0n) {
    throw new Error(
      `SALE_PRICE_ETH must be greater than zero${hasFile ? ` in ${CONTRACT_ENV_PATH}` : ""}.`,
    );
  }

  const promoLimitValue = promoLimitRaw ? Number(promoLimitRaw) : DEFAULT_PROMO_CREATION_LIMIT;
  if (!Number.isInteger(promoLimitValue) || promoLimitValue < 0) {
    throw new Error(
      `PROMO_CREATION_LIMIT must be a non-negative integer${hasFile ? ` in ${CONTRACT_ENV_PATH}` : ""}.`,
    );
  }
  const promoCreationLimit = BigInt(promoLimitValue);

  let personalizationPriceWei: bigint;
  try {
    personalizationPriceWei = parseEther(personalizationRaw || DEFAULT_PERSONALIZATION_PRICE_ETH);
  } catch (error) {
    throw new Error(
      `Invalid PERSONALIZATION_PRICE_ETH value${hasFile ? ` in ${CONTRACT_ENV_PATH}` : ""}. Use a numeric ETH amount (e.g. ${DEFAULT_PERSONALIZATION_PRICE_ETH}).`,
    );
  }

  const underlayPersonalizationPriceWei = personalizationRaw
    ? personalizationPriceWei
    : parseEther(DEFAULT_UNDERLAY_PERSONALIZATION_PRICE_ETH);

  return {
    salePriceWei,
    promoCreationLimit,
    personalizationPriceWei,
    underlayPersonalizationPriceWei,
  };
}

export function selectSunetSignerKey(
  env?: SunetEnv | null,
  options?: { required?: true },
): string;
export function selectSunetSignerKey(
  env?: SunetEnv | null,
  options?: { required?: false },
): string | null;
export function selectSunetSignerKey(
  env?: SunetEnv | null,
  options: { required?: boolean } = {},
): string | null {
  const { required = true } = options;
  const testKey = env?.TEST_ACCOUNT_PRIVATE_KEY?.trim();
  const validatorKey = env?.VALIDATOR_PRIVATE_KEY?.trim();
  const selected = testKey || validatorKey;

  if (!selected && required) {
    throw new Error(`VALIDATOR_PRIVATE_KEY is missing in ${SUNET_ENV_PATH}.`);
  }

  return selected || null;
}
