import { createModalShell } from "../base/modal-shell.js";
import { createConnectController } from "./controller.js";

let controller = null;
let shell = null;

function ensureController() {
  if (controller) return controller;
  shell = createModalShell();
  controller = createConnectController(shell);
  return controller;
}

/**
 * Open the connect modal and attempt to connect using wagmi connectors.
 * Resolves when connected or the modal is closed.
 * @returns {Promise<import("@wagmi/core").GetAccountResult | null>}
 */
export function openConnectModal() {
  return ensureController().open();
}

export function closeConnectModal() {
  controller?.close();
}
