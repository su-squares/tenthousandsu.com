import { createTxController } from "./controller.js";

/**
 * @typedef {import("./controller.js").TxController} TxController
 */

/**
 * @typedef {import("./controller.js").TxControllerOptions} TxControllerOptions
 */

/**
 * Create a modal transaction controller.
 * @param {TxControllerOptions} [options]
 * @returns {TxController}
 */
export function createTxModal(options = {}) {
  const overlay = document.createElement("div");
  overlay.className = "su-tx-overlay";
  overlay.setAttribute("aria-hidden", "true");

  const target = document.createElement("div");
  overlay.appendChild(target);
  document.body.appendChild(overlay);

  const controller = createTxController(target, { ...options, variant: "modal", showClose: true });

  controller.show = () => {
    overlay.classList.add("is-visible");
    overlay.setAttribute("aria-hidden", "false");
  };

  controller.hide = () => {
    overlay.classList.remove("is-visible");
    overlay.setAttribute("aria-hidden", "true");
    controller.reset();
  };

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      controller.hide();
    }
  });

  return controller;
}
