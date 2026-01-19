import { ensureConnected, loadWeb3 } from "../../web3/foundation.js";
import { fetchOwnedSquares } from "../../web3/services/ownership.js";

let ownershipPromise = null;

function createProgressUpdater(store) {
  let lastCompleted = -1;
  let lastTotal = null;
  let lastUpdate = 0;
  const minCountDelta = 50;
  const minTimeMs = 200;

  return (payload) => {
    const total = Number.isFinite(payload?.total) ? payload.total : null;
    const completed = Number.isFinite(payload?.completed) ? payload.completed : null;

    if (total !== null && total !== lastTotal) {
      lastTotal = total;
      lastCompleted = completed ?? 0;
      lastUpdate = Date.now();
      store.setOwnershipProgress(lastCompleted, lastTotal);
      return;
    }

    if (completed === null) return;

    const now = Date.now();
    const delta = completed - lastCompleted;
    const timeSince = now - lastUpdate;
    const isFinal = total !== null && completed >= total;
    const shouldUpdate =
      isFinal || completed === 0 || delta >= minCountDelta || timeSince >= minTimeMs;

    if (!shouldUpdate) return;

    lastCompleted = completed;
    lastUpdate = now;
    store.setOwnershipProgress(completed, lastTotal);
  };
}

export async function ensureOwnershipLoaded(options = {}) {
  const {
    store,
    wagmi = null,
    requireConnection = true,
    forceRefresh = false,
    source = "unknown",
  } = options;
  if (!store) {
    throw new Error("Missing personalize store");
  }

  const state = store.getState();
  if (!forceRefresh && state.ownershipStatus === "ready" && state.ownedSquares) {
    return state.ownedSquares;
  }

  if (!forceRefresh && state.ownershipStatus === "loading" && ownershipPromise) {
    store.setOwnershipRequestContext(source);
    return ownershipPromise;
  }

  store.setOwnershipRequestContext(source);
  store.setOwnershipStatus("loading");
  store.setOwnershipProgress(0, null);

  const updateProgress = createProgressUpdater(store);

  const runFetch = async (clients) => {
    const account = clients?.getAccount?.();
    if (!account?.address) return null;
    return fetchOwnedSquares(account.address, clients, {
      onProgress: updateProgress,
      forceRefresh,
    });
  };

  ownershipPromise = (async () => {
    let clients = wagmi;
    if (!clients) {
      if (requireConnection) {
        const connected = await ensureConnected(async (loaded) => loaded);
        if (!connected) return null;
        clients = connected;
      } else {
        clients = await loadWeb3();
      }
    }

    const owned = await runFetch(clients);
    if (!owned) {
      store.setOwnershipStatus("idle");
      store.setOwnershipProgress(0, null);
      return null;
    }

    store.setOwnedSquares(owned);
    store.setOwnershipStatus("ready");
    store.setOwnershipProgress(owned.size, owned.size);
    return owned;
  })();

  try {
    return await ownershipPromise;
  } catch (error) {
    store.setOwnershipStatus(
      "error",
      error?.message || "Unable to fetch owned Squares."
    );
    store.setOwnershipProgress(0, null);
    throw error;
  } finally {
    ownershipPromise = null;
  }
}
