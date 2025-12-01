// Browser entry for bundling wagmi + connectors + viem into a single file.
// Export only what the site needs.
export {
  configureChains,
  createConfig,
  watchAccount,
  watchNetwork,
  connect,
  disconnect,
  fetchBalance,
  fetchEnsName,
  fetchEnsAvatar,
  switchNetwork,
  writeContract,
  waitForTransaction,
  getNetwork,
  getAccount,
} from "@wagmi/core";
export { publicProvider } from "@wagmi/core/providers/public";

export { InjectedConnector } from "@wagmi/connectors/injected";
export { WalletConnectConnector } from "@wagmi/connectors/walletConnect";
export { mainnet, sepolia } from "viem/chains";
export { http } from "viem";
