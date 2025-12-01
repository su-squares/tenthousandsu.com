import { createStore } from "../base/store.js";
import { CONNECTING_VARIANT } from "./constants.js";

const initialState = {
  view: /** @type {"list" | "qr" | "connecting" | "error" | "canceled"} */ ("list"),
  qrUri: "",
  copied: false,
  connectingVariant: CONNECTING_VARIANT.DEFAULT,
  errorMessage: "",
};

export function createConnectStore() {
  return createStore(initialState);
}

export { initialState as connectInitialState };
