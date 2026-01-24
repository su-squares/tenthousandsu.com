// dapp/e2e/playwright/env.ts
//
// Loads .env, validates with Zod, derives the wallet address
// from PRIVATE_KEY using viem (for consistency with test-setup.ts).
// NOTE: PRIVATE_KEY may be provided with or without "0x"; it is normalized to "0x" + 64-hex.

import path from 'path';
import fs from 'fs';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { privateKeyToAccount } from 'viem/accounts';

type NetworkInput = 'Ethereum' | 'Sepolia' | 'Sunet';
type Network = 'ethereum' | 'sepolia' | 'sunet';

// --- ESM-safe __dirname / __filename ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- Load .env from dapp root ----
// current file: dapp/e2e/playwright/env.ts
// two levels up from here = dapp/.env
const candidatePaths = [
  path.resolve(__dirname, '../../.env'),
  path.resolve(process.cwd(), '.env'),
];

let loadedPath: string | null = null;
for (const p of candidatePaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    loadedPath = p;
    break;
  }
}
if (!loadedPath) {
  console.warn('[e2e env] .env not found. Using process.env as-is.');
}

// ---- Zod Schemas ----
const NetworkEnum = z
  .string()
  .optional()
  .transform((value) => {
    const normalized = String(value ?? 'Sepolia').trim().toLowerCase();
    if (normalized === 'ethereum' || normalized === 'mainnet') return 'Ethereum' as NetworkInput;
    if (normalized === 'sepolia') return 'Sepolia' as NetworkInput;
    if (normalized === 'sunet') return 'Sunet' as NetworkInput;
    return 'Sepolia' as NetworkInput;
  });

const PrivateKeySchema = z
  .string()
  .min(1, 'PRIVATE_KEY is required')
  .transform((v) => {
    // Comprehensive normalization to match what test-setup.ts does
    let s = String(v);
    
    // Trim standard whitespace
    s = s.trim();
    
    // Strip accidental wrapping quotes once
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      s = s.slice(1, -1);
    }
    
    // Remove invisible/zero-width & odd whitespace characters
    const INVISIBLES = /[\u200B\u200C\u200D\u200E\u200F\u2060\uFEFF\u00A0]/g;
    s = s.replace(INVISIBLES, '');
    
    // Normalize line endings & tabs
    s = s.replace(/[\r\n\t]/g, '');
    
    // Handle 0x prefix
    if (s.startsWith('0x') || s.startsWith('0X')) {
      s = s.slice(2);
    }
    
    // Validate hex characters
    const invalidMatches = s.match(/[^0-9a-fA-F]/g);
    if (invalidMatches) {
      const uniq = Array.from(new Set(invalidMatches));
      const codes = uniq.map((ch) => `U+${ch.codePointAt(0)!.toString(16).toUpperCase()}`).join(', ');
      console.error(`[e2e env] PK normalization: found non-hex chars: [${uniq.join(' ')}] (${codes})`);
      throw new Error('Private key contains non-hex characters after normalization');
    }
    
    if (s.length === 0) throw new Error('Private key is empty after normalization');
    if (s.length > 64) {
      console.error(`[e2e env] PK too long after normalization: nibbles=${s.length}`);
      throw new Error(`Private key too long (${s.length} nibbles); expected 64`);
    }
    
    // Left-pad to 64 nibbles
    const padded = s.padStart(64, '0').toLowerCase();
    const hex = `0x${padded}` as `0x${string}`;
    
    // Masked debug
    const head = padded.slice(0, 6);
    const tail = padded.slice(-4);
    console.log(`[e2e env] Using normalized PK (masked): ${head}...${tail} (nibbles=${padded.length})`);
    
    return hex;
  });

const ChainIdSchema = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === null || v === '') return undefined;
    const n = typeof v === 'number' ? v : Number(String(v).trim());
    return Number.isFinite(n) ? n : undefined;
  });

const UrlSchema = z.string().url().optional();

const BoolSchema = z
  .union([z.string(), z.boolean(), z.number()])
  .optional()
  .transform((v) => {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v === 1;
    const s = String(v ?? '').trim().toLowerCase();
    return ['1', 'true', 'yes', 'on'].includes(s);
  });

const SquareNumberSchema = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === null || v === '') return 1;
    const n = typeof v === 'number' ? v : Number(String(v).trim());
    if (!Number.isFinite(n)) return 1;
    return Math.trunc(n);
  })
  .refine((v) => v >= 1 && v <= 10000, {
    message: 'BUY_SQUARE_NUMBER must be between 1 and 10000',
  });

const RawSchema = z.object({
  PRIVATE_KEY: PrivateKeySchema,
  NETWORK: NetworkEnum.default('Sepolia'),
  CHAIN_ID: ChainIdSchema, // required only if NETWORK=Ritonet
  RPC_URL: UrlSchema,
  BASE_URL: UrlSchema,
  WALLET_NAME: z.string().optional().default('MetaMask'),
  TX_DELAY_MS: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === null || v === '') return 2000;
      const n = typeof v === 'number' ? v : Number(String(v).trim());
      if (!Number.isFinite(n) || n < 0) return 2000;
      return Math.min(n, 60_000);
    }),
  BUY_SQUARE_NUMBER: SquareNumberSchema,
  E2E_MOCK_RPC: BoolSchema.default(false),
});

// ---- Parse & Normalize ----
const raw = RawSchema.parse({
  PRIVATE_KEY: process.env.PRIVATE_KEY,
  NETWORK: process.env.NETWORK,
  CHAIN_ID: process.env.CHAIN_ID,
  RPC_URL: process.env.RPC_URL,
  BASE_URL: process.env.TEST_BASE_URL,
  WALLET_NAME: process.env.WALLET_NAME,
  TX_DELAY_MS: process.env.TX_DELAY_MS,
  BUY_SQUARE_NUMBER: process.env.BUY_SQUARE_NUMBER,
  E2E_MOCK_RPC: process.env.E2E_MOCK_RPC,
});

const networkMap: Record<NetworkInput, Network> = {
  Ethereum: 'ethereum',
  Sepolia: 'sepolia',
  Sunet: 'sunet',
};

const defaultChainIds: Partial<Record<Network, number>> = {
  ethereum: 1,
  sepolia: 11155111,
};

const normalizedNetwork = networkMap[raw.NETWORK];
const derivedChainId = normalizedNetwork !== 'sunet' ? defaultChainIds[normalizedNetwork] : undefined;
const chainId = raw.CHAIN_ID ?? derivedChainId;

if (normalizedNetwork === 'sunet' && (chainId === undefined || chainId === null)) {
  throw new Error('[e2e env] CHAIN_ID is required when NETWORK=Sunet (custom network)');
}

if (!chainId || !Number.isFinite(chainId)) {
  throw new Error('[e2e env] Unable to determine a valid CHAIN_ID');
}

// Derive address from private key using viem (same as test-setup.ts)
let derivedAddress: `0x${string}`;
try {
  const account = privateKeyToAccount(raw.PRIVATE_KEY);
  derivedAddress = account.address;
  console.log(`[e2e env] Derived address from private key: ${derivedAddress}`);
} catch (e) {
  throw new Error(`[e2e env] Failed to derive address from PRIVATE_KEY: ${(e as Error).message}`);
}

// ---- Final typed export ----
export const e2eEnv = {
  network: normalizedNetwork as Network,
  chainId: chainId as number,
  privateKey: raw.PRIVATE_KEY,
  address: derivedAddress,
  rpcUrl: raw.RPC_URL,
  baseUrl: raw.BASE_URL,
  walletName: raw.WALLET_NAME,
  txDelayMs: raw.TX_DELAY_MS,
  buySquareNumber: raw.BUY_SQUARE_NUMBER,
  mockRpc: raw.E2E_MOCK_RPC,
  loadedFrom: loadedPath,
} as const;

export const walletConfigFromEnv = {
  address: e2eEnv.address,
  privateKey: e2eEnv.privateKey,
  chainId: e2eEnv.chainId,
  walletName: e2eEnv.walletName,
  walletIcon: 'assets/images/github-logo.svg',
  txDelay: e2eEnv.txDelayMs,
  rpcUrl: e2eEnv.rpcUrl,
} as const;

let logged = false;
export function logE2eEnvOnce() {
  if (logged) return;
  console.log(
    `[e2e env] network=${e2eEnv.network} chainId=${e2eEnv.chainId} wallet=${e2eEnv.walletName} address=${e2eEnv.address} txDelayMs=${e2eEnv.txDelayMs} mockRpc=${e2eEnv.mockRpc} buySquareNumber=${e2eEnv.buySquareNumber}${
      e2eEnv.loadedFrom ? ` (loaded ${e2eEnv.loadedFrom})` : ''
    }`
  );
  logged = true;
}
