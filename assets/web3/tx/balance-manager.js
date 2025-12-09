/**
 * @typedef {import("./state.js").TxState} TxState
 */

/**
 * @typedef {Object} BalanceManagerDependencies
 * @property {(patch: Object|((state: TxState) => void)) => void} updateState
 * @property {() => TxState} getState
 */

/**
 * @typedef {Object} BalanceManager
 * @property {(context: TxState["balanceContext"] | null | undefined) => Promise<void>} setContext
 * @property {() => Promise<void>} invalidateAndRefresh
 * @property {() => Promise<void>} refresh
 * @property {() => void} destroy
 */

/**
 * Manage balance subscriptions and fetch lifecycle.
 * @param {BalanceManagerDependencies} deps
 * @returns {BalanceManager}
 */
export function createBalanceManager({ updateState, getState }) {
  let balanceUnsubscribe = null;

  const cleanupSubscription = () => {
    if (typeof balanceUnsubscribe === "function") {
      balanceUnsubscribe();
      balanceUnsubscribe = null;
    }
  };

  const matchesAddress = (payloadAddress, target) =>
    payloadAddress?.toLowerCase() === target?.toLowerCase();

  const setLoading = (value) => {
    updateState((draft) => {
      draft.balanceLoading = value;
    });
  };

  async function setContext(context) {
    if (!context || !context.address || !context.chainId || !context.fetcher) {
      cleanupSubscription();
      updateState((draft) => {
        draft.showBalance = false;
        draft.balance = null;
        draft.balanceContext = null;
        draft.balanceLoading = false;
      });
      return;
    }

    const { address, chainId, fetcher } = context;
    updateState((draft) => {
      draft.balanceContext = { address, chainId, fetcher };
      draft.showBalance = true;
      draft.balanceLoading = true;
    });

    try {
      const { getBalance, getCachedBalance, subscribeBalance } = await import("../wallet/balance-store.js");

      const cached = getCachedBalance(address, chainId);
      if (cached) {
        updateState((draft) => {
          draft.balance = cached;
          draft.balanceLoading = false;
        });
      }

      cleanupSubscription();
      balanceUnsubscribe = subscribeBalance((payload) => {
        if (matchesAddress(payload.address, address)) {
          updateState((draft) => {
            draft.balance = payload.balance;
            draft.balanceLoading = false;
          });
        }
      });

      const result = await getBalance({ address, chainId, fetcher });
      updateState((draft) => {
        draft.balance = result?.balance || null;
        draft.balanceLoading = false;
      });
    } catch (error) {
      console.warn("TX fixture: Balance fetch failed", error);
      setLoading(false);
    }
  }

  async function invalidateAndRefresh() {
    const context = getState().balanceContext;
    if (!context) return;

    try {
      const { invalidateBalance, refreshBalance } = await import("../wallet/balance-store.js");
      const { address, chainId, fetcher } = context;
      invalidateBalance(address, chainId);
      if (fetcher) {
        setLoading(true);
        await refreshBalance(address, chainId, fetcher);
      }
    } catch (error) {
      console.warn("TX fixture: Balance invalidation failed", error);
      setLoading(false);
    }
  }

  async function refresh() {
    const context = getState().balanceContext;
    if (!context || !context.fetcher) return;
    const { refreshBalance } = await import("../wallet/balance-store.js");
    await refreshBalance(context.address, context.chainId, context.fetcher);
  }

  function destroy() {
    cleanupSubscription();
  }

  return { setContext, invalidateAndRefresh, refresh, destroy };
}
