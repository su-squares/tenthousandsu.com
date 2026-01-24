// dapp/e2e/playwright/wallet/types.ts
export interface WalletStubConfig {
  address?: string;
  privateKey?: string;
  chainId?: number;
  walletName?: string;
  walletIcon?: string;
  persistConnection?: boolean;
  uuid?: string;
  rdns?: string;
  txDelay?: number;
  // real-mode flags
  real?: boolean;       // if true, do real tx/signing via Node bridge
  rpcUrl?: string;      // real RPC endpoint (public by default)
}
