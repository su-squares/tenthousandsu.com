import { isValidSquareId } from "./store.js";
import { attachListChooserPersonalize } from "../../square-lookup/list-chooser-personalize.js";
import { ensureOwnershipLoaded } from "./ownership.js";

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
    try {
      const result = await ensureOwnershipLoaded({
        store,
        requireConnection: true,
        source: "chooser",
      });

      if (!result) {
        throw new Error("Wallet connection required to open the chooser.");
      }

      onOwnershipReady();
      return Array.from(result);
    } catch (error) {
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
