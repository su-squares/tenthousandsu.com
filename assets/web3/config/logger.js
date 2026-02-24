import { getWeb3Config } from "./index.js";

export function createDebugLogger(scope) {
  return (...args) => {
    if (getWeb3Config().debug) {
      console.debug(`[${scope}]`, ...args);
    }
  };
}
