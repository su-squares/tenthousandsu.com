import { createTxController } from "./controller.js";

/**
 * @typedef {import("./controller.js").TxController} TxController
 */

/**
 * @typedef {import("./controller.js").TxControllerOptions} TxControllerOptions
 */

/**
 * Create an inline transaction fixture controller.
 * @param {(TxControllerOptions & { target?: HTMLElement })} [options]
 * @returns {TxController}
 */
export function createTxFixture(options = {}) {
  const { target: providedTarget, ...rest } = options;
  const target = providedTarget || document.createElement("div");
  return createTxController(target, { ...rest, variant: "fixture" });
}
