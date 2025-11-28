import { walletConnectProjectId } from "./config.js";

let cachedClients = null;
const readyCallbacks = [];
const wagmiLocalStorageKey = "wagmi.store";

export function onWeb3Ready(callback) {
  if (cachedClients) {
    queueMicrotask(() => callback(cachedClients));
    return;
  }
  readyCallbacks.push(callback);
}

async function loadLibraries() {
  // Web3Modal requires process.env to exist, stub just enough for the library.
  if (!window.process) {
    window.process = { env: { NODE_ENV: "development" } };
  }
  const [ethereumLib, web3ModalLib] = await Promise.all([
    import("https://unpkg.com/@web3modal/ethereum@2.7.1"),
    import("https://unpkg.com/@web3modal/html@2.7.1"),
  ]);
  return { ethereumLib, web3ModalLib };
}

function hasPersistedWagmiConnection() {
  try {
    const raw = localStorage.getItem(wagmiLocalStorageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      const connections = parsed?.state?.connections;
      if (Array.isArray(connections) && connections.length > 0) return true;
      if (connections && typeof connections === "object" && Object.keys(connections).length > 0)
        return true;
    }
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("wc@2:client:")) {
        const value = localStorage.getItem(key);
        if (value && value !== "{}") return true;
      }
    }
  } catch (error) {
    console.warn("Unable to inspect wagmi storage", error);
  }
  return false;
}

export function shouldEagerLoadWeb3() {
  // Opt-out: set window.suWeb3 = { autoLoad: false } before nav-menu-head include.
  // Opt-in: set window.suWeb3 = { autoLoad: true } to force eager load even without stored session.
  const config = window.suWeb3;
  if (config?.autoLoad === false) return false;
  if (config?.autoLoad === true) return true;
  return hasPersistedWagmiConnection();
}

export async function loadWeb3() {
  if (cachedClients) return cachedClients;

  const { ethereumLib, web3ModalLib } = await loadLibraries();
  const {
    EthereumClient,
    w3mConnectors,
    w3mProvider,
    WagmiCore,
    WagmiCoreChains,
  } = ethereumLib;
  const { Web3Modal } = web3ModalLib;
  const { configureChains, createConfig, writeContract, waitForTransaction } =
    WagmiCore;
  const { mainnet } = WagmiCoreChains;

  const chains = [mainnet];
  const { publicClient } = configureChains(chains, [
    w3mProvider({ projectId: walletConnectProjectId }),
  ]);
  const wagmiConfig = createConfig({
    autoConnect: true,
    connectors: w3mConnectors({ projectId: walletConnectProjectId, chains }),
    publicClient,
  });
  const ethereumClient = new EthereumClient(wagmiConfig, chains);
  const web3modal = new Web3Modal(
    { projectId: walletConnectProjectId },
    ethereumClient
  );

  cachedClients = { ethereumClient, web3modal, writeContract, waitForTransaction };
  readyCallbacks.splice(0).forEach((cb) => cb(cachedClients));
  return cachedClients;
}

export async function ensureConnected(action) {
  const { ethereumClient, web3modal } = await loadWeb3();
  const runAction = () => action(cachedClients);

  if (ethereumClient.getAccount().isConnected) {
    return runAction();
  }

  return new Promise(async (resolve, reject) => {
    let finished = false;
    const cleanup = () => {
      finished = true;
      try {
        accountUnsubscribe();
      } catch (e) {
        /* no-op */
      }
      try {
        modalUnsubscribe();
      } catch (e) {
        /* no-op */
      }
    };

    const accountUnsubscribe = ethereumClient.watchAccount((account) => {
      if (!account.isConnected || finished) return;
      cleanup();
      resolve(runAction());
    });
    const modalUnsubscribe = web3modal.subscribeModal((modalState) => {
      if (modalState.open || finished) return;
      cleanup();
      resolve();
    });

    try {
      await web3modal.openModal();
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}
