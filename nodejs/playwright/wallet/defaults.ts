// dapp/e2e/playwright/wallet/defaults.ts
import type { WalletStubConfig } from './types.js';

export type FinalWalletConfig =
  Required<Omit<WalletStubConfig, 'rpcUrl'>> & { rpcUrl?: string };

export const DEFAULT_WALLET_CONFIG: FinalWalletConfig = {
  address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  chainId: 11155111, // Sepolia
  walletName: 'Test Wallet',
  walletIcon: '/images/wallet-default.svg',
  persistConnection: false,
  uuid: 'test-wallet-uuid',
  rdns: 'com.testwallet',
  txDelay: 2000,
  real: false,
  rpcUrl: undefined,
};
