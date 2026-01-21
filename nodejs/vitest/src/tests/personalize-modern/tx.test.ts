import { isUserRejectedError } from "@assets-js/personalize-modern/tx.js";

describe("isUserRejectedError", () => {
  describe("error code detection", () => {
    it("returns true for MetaMask rejection code 4001", () => {
      const error = { code: 4001 };
      expect(isUserRejectedError(error, "")).toBe(true);
    });

    it("returns true for ACTION_REJECTED code", () => {
      const error = { code: "ACTION_REJECTED" };
      expect(isUserRejectedError(error, "")).toBe(true);
    });

    it("detects code in error.cause", () => {
      const error = { cause: { code: 4001 } };
      expect(isUserRejectedError(error, "")).toBe(true);
    });
  });

  describe("error name detection", () => {
    it("detects UserRejected in error name", () => {
      const error = { name: "UserRejectedRequestError" };
      expect(isUserRejectedError(error, "")).toBe(true);
    });

    it("detects userrejected case-insensitively", () => {
      const error = { name: "USERREJECTED" };
      expect(isUserRejectedError(error, "")).toBe(true);
    });

    it("detects name in error.cause", () => {
      const error = { cause: { name: "UserRejectedRequestError" } };
      expect(isUserRejectedError(error, "")).toBe(true);
    });
  });

  describe("message text detection", () => {
    it("detects 'user rejected' in message parameter", () => {
      expect(isUserRejectedError({}, "User rejected the request")).toBe(true);
    });

    it("detects 'user denied' in message", () => {
      expect(isUserRejectedError({}, "User denied transaction signature")).toBe(true);
    });

    it("detects 'request rejected' in message", () => {
      expect(isUserRejectedError({}, "Request rejected by user")).toBe(true);
    });

    it("detects 'denied transaction' in message", () => {
      expect(isUserRejectedError({}, "Denied transaction")).toBe(true);
    });

    it("detects rejection text in error.shortMessage", () => {
      const error = { shortMessage: "User rejected the request" };
      expect(isUserRejectedError(error, "")).toBe(true);
    });

    it("detects rejection text in error.cause.shortMessage", () => {
      const error = { cause: { shortMessage: "User denied transaction" } };
      expect(isUserRejectedError(error, "")).toBe(true);
    });
  });

  describe("non-rejection errors", () => {
    it("returns false for network errors", () => {
      const error = { message: "Network error", code: -32000 };
      expect(isUserRejectedError(error, "Network error")).toBe(false);
    });

    it("returns false for generic transaction failures", () => {
      const error = { message: "Transaction failed" };
      expect(isUserRejectedError(error, "Transaction failed")).toBe(false);
    });

    it("returns false for insufficient funds", () => {
      const error = { message: "Insufficient funds for gas" };
      expect(isUserRejectedError(error, "Insufficient funds")).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("handles null error gracefully", () => {
      expect(isUserRejectedError(null, "")).toBe(false);
    });

    it("handles undefined error gracefully", () => {
      expect(isUserRejectedError(undefined, "")).toBe(false);
    });

    it("handles empty error object", () => {
      expect(isUserRejectedError({}, "")).toBe(false);
    });

    it("handles null message", () => {
      expect(isUserRejectedError({}, null as unknown as string)).toBe(false);
    });

    it("handles undefined message", () => {
      expect(isUserRejectedError({}, undefined as unknown as string)).toBe(false);
    });
  });
});
