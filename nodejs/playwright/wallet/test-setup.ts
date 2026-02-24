// dapp/e2e/playwright/wallet/test-setup.ts
import type { Page } from '@playwright/test';
import { injectWallet } from './provider.js';
import { ensureInjectedBuilt } from './build-helper.js'; // <-- added

// === viem (Node side) for REAL signing/broadcast ===
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

export interface TestSetupOptions {
  clearStorage?: boolean;
  injectWallet?: boolean;
  walletConfig?: {
    address?: string;       // optional; we derive from PK if missing
    privateKey?: string;    // if present -> REAL mode
    chainId?: number;       // default 11155111 (Sepolia)
    walletName?: string;
    walletIcon?: string;
    txDelay?: number;       // used only in MOCK mode
  };
  /** If true, the mock wallet will auto-return the account on eth_accounts after reload. */
  persistConnection?: boolean;
}

/**
 * Public RPCs to avoid any setup. These are community endpoints; rate limits apply.
 * Default: Sepolia (11155111).
 */
const PUBLIC_SEPOLIA_RPCS = [
  'https://ethereum-sepolia-rpc.publicnode.com',
  'https://rpc.sepolia.org',
];

function pickPublicRpcUrl(chainId?: number): string {
  if (chainId && chainId !== sepolia.id) {
    return PUBLIC_SEPOLIA_RPCS[0];
  }
  return PUBLIC_SEPOLIA_RPCS[0];
}

/**
 * Sets up the test page and (optionally) injects a wallet provider.
 * If a private key is provided, we run in REAL mode and sign/broadcast via the Node bridge.
 */
export async function setupTest(page: Page, options: TestSetupOptions = {}) {
  const {
    clearStorage = true,
    injectWallet: shouldInjectWallet = true,
    walletConfig = {},
    persistConnection = false,
  } = options;

  const finalWalletConfig: any = {
    ...walletConfig,
    persistConnection,
  };

  // 1) Clear storage strategy
  if (clearStorage && !persistConnection) {
    await page.addInitScript(() => {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes('wagmi') || key.includes('wallet'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
        sessionStorage.clear();
      } catch (e) {
        console.warn('[Test Setup] Failed to clear storage:', e);
      }
    });
  } else if (clearStorage && persistConnection) {
    await page.addInitScript(() => {
      try {
        const FIRST_LOAD_KEY = '__test_first_load_marker';
        const isFirstLoad = !sessionStorage.getItem(FIRST_LOAD_KEY);

        if (isFirstLoad) {
          sessionStorage.setItem(FIRST_LOAD_KEY, 'true');

          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.includes('wagmi') || (key.includes('wallet') && !key.includes('testwallet')))) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach((k) => localStorage.removeItem(k));
          localStorage.removeItem('testwallet.connected');
        }
      } catch (e) {
        console.warn('[Test Setup] Failed to clear storage:', e);
      }
    });
  }

  // 2) REAL mode bridge if privateKey provided
  const hasPrivateKey = !!finalWalletConfig.privateKey;
  if (hasPrivateKey) {
    const privateKey = finalWalletConfig.privateKey as `0x${string}`;
    const chainId = finalWalletConfig.chainId ?? 11155111;

    if (!privateKey.startsWith('0x') || privateKey.length !== 66) {
      throw new Error(`[Test Setup] Invalid private key format. Expected 0x + 64 hex chars, got: ${privateKey.length} chars`);
    }

    console.log(`[Test Wallet BRIDGE] Using private key (masked): ${privateKey.slice(0, 8)}...${privateKey.slice(-4)}`);

    const rpcUrl = finalWalletConfig.rpcUrl || pickPublicRpcUrl(chainId);
    const transport = http(rpcUrl);

    const chain = sepolia.id === chainId ? sepolia : {
      ...sepolia,
      id: chainId,
      rpcUrls: { ...sepolia.rpcUrls, default: { http: [rpcUrl] }, public: { http: [rpcUrl] } },
    };

    const account = privateKeyToAccount(privateKey);
    console.log(`[Test Wallet BRIDGE] Derived address from privateKey: ${account.address}`);

    if (finalWalletConfig.address) {
      const providedAddress = finalWalletConfig.address as string;
      if (account.address.toLowerCase() !== providedAddress.toLowerCase()) {
        console.error(`[Test Wallet BRIDGE] ERROR: Address mismatch!`);
        console.error(`[Test Wallet BRIDGE] Provided address: ${providedAddress}`);
        console.error(`[Test Wallet BRIDGE] Derived address: ${account.address}`);
        throw new Error('Address mismatch: The provided address does not match the derived address from the private key');
      }
      console.log(`[Test Wallet BRIDGE] Verified: provided address matches derived address`);
    }

    const publicClient = createPublicClient({ chain, transport });
    const walletClient = createWalletClient({ account, chain, transport });

    // generic RPC passthrough
    await page.exposeFunction('__testwallet_rpc', async (method: string, params: any[]) => {
      console.log(`[Test Wallet BRIDGE] RPC -> ${method}`, params ?? []);
      const result = await publicClient.request({ method: method as any, params: params as any });
      console.log(`[Test Wallet BRIDGE] RPC <- ${method} result:`, result);
      return result;
    });

    // sign + send a real tx
    await page.exposeFunction('__testwallet_sendTransaction', async (tx: any) => {
      console.log('[Test Wallet BRIDGE] sendTransaction ->', tx);
      const hash = await walletClient.sendTransaction({
        account,
        to: tx?.to as `0x${string}` | undefined,
        data: tx?.data as `0x${string}` | undefined,
        value: tx?.value ? BigInt(tx.value) : undefined,
        gas: tx?.gas ? BigInt(tx.gas) : undefined,
        nonce: tx?.nonce ? Number(tx.nonce) : undefined,
      });
      console.log('[Test Wallet BRIDGE] txHash <-', hash);
      return hash;
    });

    // message signing (hex-aware)
    await page.exposeFunction('__testwallet_signMessage', async (payload: { message: string; isHex: boolean }) => {
      console.log('[Test Wallet BRIDGE] Signing message with account:', account.address);
      console.log('[Test Wallet BRIDGE] Message is hex:', payload.isHex);
      console.log('[Test Wallet BRIDGE] Message (first 100 chars):', payload.message.substring(0, 100));

      let sig: string;
      if (payload.isHex && payload.message.startsWith('0x')) {
        const hexString = payload.message.slice(2);
        const bytes = new Uint8Array(hexString.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
        console.log('[Test Wallet BRIDGE] Signing hex message as raw bytes, length:', bytes.length);
        sig = await walletClient.signMessage({ account, message: { raw: bytes } });
      } else {
        console.log('[Test Wallet BRIDGE] Signing UTF-8 string message');
        sig = await walletClient.signMessage({ account, message: payload.message });
      }
      console.log('[Test Wallet BRIDGE] signMessage <-', sig);
      return sig;
    });

    // typed data v4 signing
    await page.exposeFunction('__testwallet_signTypedData', async (payload: any) => {
      console.log('[Test Wallet BRIDGE] Signing typed data with account:', account.address);
      const sig = await walletClient.signTypedData({ account, ...payload });
      console.log('[Test Wallet BRIDGE] signTypedData <-', sig);
      return sig;
    });

    finalWalletConfig.real = true;
    finalWalletConfig.rpcUrl = rpcUrl;
    finalWalletConfig.address = account.address; // Always use the derived address
    console.log(`[Test Wallet BRIDGE] Final wallet config address: ${finalWalletConfig.address}`);
  }

  // 3) Inject provider BEFORE app scripts run
  if (shouldInjectWallet) {
    await ensureInjectedBuilt();              // <-- ensure injected bundle exists
    await injectWallet(page, finalWalletConfig);
  }

  // 4) Console + page error logging
  page.on('console', (msg) => {
    const text = msg.text();
    if (
      text.includes('[Test Wallet]') ||
      text.includes('[REAL]') ||
      text.includes('[BRIDGE]') ||
      text.toLowerCase().includes('wagmi') ||
      text.toLowerCase().includes('error')
    ) {
      console.log(`Browser console: ${text}`);
    }
  });

  page.on('pageerror', (err) => {
    console.error(`Page error: ${err.message}`);
  });

  return {
    /** Only waits for the provider object to exist. No accounts required. */
    async waitForProvider() {
      await page.waitForFunction(
        () => typeof window !== 'undefined' && (window as any).ethereum !== undefined,
        { timeout: 10_000 }
      );
      await page.waitForTimeout(200);
    },

    /** Waits for stubbed accounts to be present (use AFTER connecting, or when persistConnection=true). */
    async waitForAccounts(timeoutMs: number = 10_000) {
      await page.waitForFunction(
        () => {
          const eth: any = (window as any).ethereum;
          const accs = eth?._accounts;
          return Array.isArray(accs) && accs.length > 0;
        },
        { timeout: timeoutMs }
      );
      await page.waitForTimeout(100);
    },

    /** Back-compat shim: previously waited for provider+accounts; now only provider. */
    async waitForWagmi() {
      await this.waitForProvider();
    },

    async debugWalletState() {
      const state = await page.evaluate(() => {
        const allLocalStorage = Object.keys(localStorage).reduce(
          (acc, key) => {
            acc[key] = localStorage.getItem(key);
            return acc;
          },
          {} as Record<string, string | null>
        );

        return {
          ethereum: !!(window as any).ethereum,
          wagmiStore: localStorage.getItem('wagmi.store'),
          wagmiConnected: localStorage.getItem('wagmi.connected'),
          account: localStorage.getItem('wagmi.account'),
          testWalletAddress: (window as any).ethereum?._accounts?.[0] || 'none',
          allLocalStorage,
        };
      });

      console.log('Current wallet state:', JSON.stringify(state, null, 2));
      return state;
    },

    async disconnectWallet(clearWagmi: boolean = true) {
      await page.evaluate((doClear) => {
        const eth = (window as any).ethereum;
        if (eth && typeof eth.disconnect === 'function') {
          eth.disconnect();
        }
        if (doClear) {
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.includes('wagmi')) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach((k) => localStorage.removeItem(k));
        }
      }, clearWagmi);
    },
  };
}
