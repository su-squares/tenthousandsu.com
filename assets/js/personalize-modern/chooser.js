import { ensureConnected } from "../../web3/foundation.js";
import { fetchOwnedSquares } from "../../web3/services/ownership.js";
import { isValidSquareId } from "./store.js";
import { attachListChooserPersonalize } from "../../square-lookup/list-chooser-personalize.js";

export function initPersonalizeChooser({
  store,
  trigger,
  onSelectionChange = () => {},
  onConfirm = () => {},
  onOpen = () => {},
  onOwnershipReady = () => {},
}) {
  if (!trigger) return null;

  const getSelectedIds = () => {
    const { rows } = store.getState();
    return rows
      .map((row) => row.squareId)
      .filter((id) => isValidSquareId(id));
  };

  const getSquares = async () => {
    store.setOwnershipStatus("loading");
    try {
      const result = await ensureConnected(async (wagmi) => {
        const account = wagmi.getAccount?.();
        if (!account?.address) {
          return null;
        }
        const owned = await fetchOwnedSquares(account.address, wagmi);
        return owned;
      });

      if (!result) {
        store.setOwnershipStatus("idle");
        throw new Error("Wallet connection required to open the chooser.");
      }

      store.setOwnedSquares(result);
      store.setOwnershipStatus("ready");
      onOwnershipReady();
      return Array.from(result);
    } catch (error) {
      store.setOwnershipStatus("error", error?.message || "Unable to fetch owned Squares.");
      throw error;
    }
  };

  return attachListChooserPersonalize({
    trigger,
    title: "Select squares then press okay",
    description: "Choose the Squares you want to personalize.",
    getSquares,
    getSelectedIds,
    onSelectionChange,
    onConfirm,
    onOpen,
    onClose: () => {},
  });
}
