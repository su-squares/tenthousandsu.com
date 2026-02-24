import { getWeb3Config, ChainKey } from "./config.js";

const BILLBOARD_SUCCESS_MESSAGE =
  "Success! The Billboard updates hourly, check in soon to see your personalized Squares.";

export function maybeAlertBillboardUpdate() {
  const { activeNetwork } = getWeb3Config();
  if (activeNetwork?.key !== ChainKey.MAINNET) return;
  if (typeof window !== "undefined" && typeof window.alert === "function") {
    window.alert(BILLBOARD_SUCCESS_MESSAGE);
  }
}
