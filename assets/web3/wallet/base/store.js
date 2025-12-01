/**
 * Minimal observable store for UI state.
 * @template T
 * @param {T} initialState
 */
export function createStore(initialState) {
  /** @type {T} */
  let state = { ...initialState };
  /** @type {Set<(next: T, prev: T) => void>} */
  const listeners = new Set();

  const notify = (next, prev) => {
    listeners.forEach((listener) => {
      try {
        listener(next, prev);
      } catch (error) {
        console.warn("[store] listener error", error);
      }
    });
  };

  return {
    /** @returns {T} */
    getState() {
      return state;
    },
    /**
     * Update state with a partial object or producer function.
     * @param {Partial<T> | ((prev: T) => T)} updater
     */
    setState(updater) {
      const prev = state;
      const next =
        typeof updater === "function" ? /** @type {T} */ (updater(prev)) : { ...prev, ...updater };
      state = next;
      notify(next, prev);
    },
    /**
     * Reset to initial state.
     */
    reset() {
      const prev = state;
      state = { ...initialState };
      notify(state, prev);
    },
    /**
     * Subscribe to changes.
     * @param {(next: T, prev: T) => void} listener
     * @returns {() => void} unsubscribe
     */
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
