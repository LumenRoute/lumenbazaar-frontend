import { describe, expect, it } from "vitest";

import { ApiClientError } from "@/services/api/client";

import {
  emptyStateForCollection,
  isSensitivePaymentKey,
  normalizeUiError,
  redactSensitivePaymentData
} from "./ui-state";

describe("UI state hardening", () => {
  it("normalizes API errors with stable machine-readable codes", () => {
    const state = normalizeUiError(
      new ApiClientError({
        code: "RESOURCE_NOT_FOUND",
        message: "Missing resource.",
        requestId: "req_1",
        status: 404
      }),
      {
        description: "Fallback",
        title: "Resource unavailable"
      }
    );

    expect(state).toEqual({
      code: "RESOURCE_NOT_FOUND",
      description: "Missing resource.",
      requestId: "req_1",
      title: "Resource unavailable"
    });
  });

  it("provides reusable empty-state copy", () => {
    expect(emptyStateForCollection("payments").title).toBe("No payment attempts loaded");
    expect(emptyStateForCollection("conformance").description).toContain("conformance");
  });

  it("redacts payment payloads and wallet data recursively", () => {
    const redacted = redactSensitivePaymentData({
      nested: {
        paymentPayload: {
          authorization: "signed payload"
        },
        publicMemo: "safe"
      },
      walletAddress: "GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE"
    });

    expect(redacted).toEqual({
      nested: {
        paymentPayload: "[redacted]",
        publicMemo: "safe"
      },
      walletAddress: "[redacted]"
    });
    expect(isSensitivePaymentKey("signedXdr")).toBe(true);
  });
});
