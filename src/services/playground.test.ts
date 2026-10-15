import { describe, expect, it } from "vitest";

import { demoResources } from "@/fixtures/lumenbazaar";
import { paymentFlowStateLabels } from "@/services/api/schemas";

import {
  buildPaymentRequiredPreview,
  buildPlaygroundPaymentRequest,
  buildSampleRequest,
  markSettlementAsLive,
  markVerificationAsLive,
  simulateSettlement,
  simulateVerification
} from "./playground";

describe("payment playground helpers", () => {
  it("keeps every payment lifecycle label distinct", () => {
    expect(new Set(Object.values(paymentFlowStateLabels)).size).toBe(5);
  });

  it("generates sample requests from JSON schema properties", () => {
    expect(
      buildSampleRequest({
        properties: {
          city: {
            examples: ["Lagos"],
            type: "string"
          },
          includeForecast: {
            type: "boolean"
          },
          days: {
            default: 3,
            type: "integer"
          }
        },
        type: "object"
      })
    ).toEqual({
      city: "Lagos",
      days: 3,
      includeForecast: true
    });
  });

  it("builds backend-compatible exact payment requests", () => {
    const resource = demoResources[0]!;
    const request = buildPlaygroundPaymentRequest(resource, {
      authorizationMode: "simulation",
      paymentHash: "payhash_test"
    });

    expect(request).toMatchObject({
      paymentPayload: {
        accepted: {
          extra: {
            paymentHash: "payhash_test",
            resourceId: resource.id
          },
          scheme: "exact"
        },
        payload: {
          transaction: "simulation"
        },
        x402Version: 2
      },
      paymentRequirements: {
        amount: "500000",
        scheme: "exact"
      },
      x402Version: 2
    });
  });

  it("builds 402 preview headers from selected resources", () => {
    const preview = buildPaymentRequiredPreview(demoResources[0]!);

    expect(preview.statusCode).toBe(402);
    expect(JSON.parse(preview.headers["PAYMENT-REQUIRED"] ?? "{}")).toMatchObject({
      accepts: [
        {
          scheme: "exact"
        }
      ],
      x402Version: 2
    });
  });

  describe("simulation mode discrimination", () => {
    it("simulates verify results with explicit simulation dataMode", () => {
      const request = buildPlaygroundPaymentRequest(demoResources[0]!, {
        paymentHash: "hash_demo"
      });
      const verification = simulateVerification(request);

      expect(verification).toMatchObject({
        dataMode: "simulation",
        extra: {
          lumenbazaar: {
            paymentHash: "hash_demo",
            status: "verified"
          }
        },
        isValid: true
      });
    });

    it("simulates settle results with explicit simulation dataMode", () => {
      const request = buildPlaygroundPaymentRequest(demoResources[0]!, {
        paymentHash: "hash_demo"
      });
      const verification = simulateVerification(request);
      const settlement = simulateSettlement(request, verification);

      expect(settlement).toMatchObject({
        dataMode: "simulation",
        extra: {
          lumenbazaar: {
            paymentAttemptId: verification.extra?.lumenbazaar.paymentAttemptId,
            status: "confirmed",
            transactionHash: "d8f22ec3e5f24f1ba6ef0d42370c8c3fb7fd7d845f9df04379524665b86a16e4"
          }
        },
        success: true,
        transaction: "d8f22ec3e5f24f1ba6ef0d42370c8c3fb7fd7d845f9df04379524665b86a16e4"
      });
    });

    it("marks live verification with explicit live dataMode", () => {
      const mockLiveVerification = {
        isValid: true,
        extra: {
          lumenbazaar: {
            adapter: "@x402/stellar",
            correlationId: "corr_live_123",
            network: "stellar:testnet",
            paymentAttemptId: "attempt_live_123",
            paymentHash: "hash_live_123",
            status: "verified"
          }
        }
      };

      const marked = markVerificationAsLive(mockLiveVerification as any);

      expect(marked.dataMode).toBe("live");
      expect(marked.isValid).toBe(true);
    });

    it("marks live settlement with explicit live dataMode", () => {
      const mockLiveSettlement = {
        success: true,
        amount: "500000",
        network: "stellar:testnet",
        transaction: "abc123def456",
        extra: {
          lumenbazaar: {
            correlationId: "corr_live_123",
            ledger: 113_300,
            paymentAttemptId: "attempt_live_123",
            receiptId: "receipt_live_123",
            status: "confirmed",
            transactionHash: "abc123def456"
          }
        }
      };

      const marked = markSettlementAsLive(mockLiveSettlement as any);

      expect(marked.dataMode).toBe("live");
      expect(marked.success).toBe(true);
    });

    it("simulated transaction hash is recognizable as synthetic", () => {
      const request = buildPlaygroundPaymentRequest(demoResources[0]!);
      const verification = simulateVerification(request);
      const settlement = simulateSettlement(request, verification);

      // Synthetic hash should be the predictable playground hash
      expect(settlement.transaction).toBe("d8f22ec3e5f24f1ba6ef0d42370c8c3fb7fd7d845f9df04379524665b86a16e4");
      // And marked as simulation
      expect(settlement.dataMode).toBe("simulation");
    });

    it("live and simulated records cannot be mixed", () => {
      const request = buildPlaygroundPaymentRequest(demoResources[0]!);
      const simulated = simulateVerification(request);
      const marked = markVerificationAsLive({
        isValid: true,
        extra: {
          lumenbazaar: {
            adapter: "@x402/stellar",
            correlationId: "corr_live",
            network: "stellar:testnet",
            paymentAttemptId: "attempt_live",
            paymentHash: "hash_live",
            status: "verified"
          }
        }
      } as any);

      // Type system ensures they can be distinguished
      expect(simulated.dataMode).toBe("simulation");
      expect(marked.dataMode).toBe("live");
      expect(simulated.dataMode).not.toBe(marked.dataMode);
    });

    it("all simulated records have consistent attempt IDs prefixed with 'attempt_playground'", () => {
      const request1 = buildPlaygroundPaymentRequest(demoResources[0]!, {
        paymentHash: "hash_1"
      });
      const request2 = buildPlaygroundPaymentRequest(demoResources[0]!, {
        paymentHash: "hash_2"
      });

      const verification1 = simulateVerification(request1);
      const verification2 = simulateVerification(request2);

      expect(verification1.extra?.lumenbazaar.paymentAttemptId).toMatch(/^attempt_playground_/);
      expect(verification2.extra?.lumenbazaar.paymentAttemptId).toMatch(/^attempt_playground_/);
    });

    it("all simulated settlement receipt IDs are prefixed with 'receipt_attempt_playground'", () => {
      const request = buildPlaygroundPaymentRequest(demoResources[0]!);
      const verification = simulateVerification(request);
      const settlement = simulateSettlement(request, verification);

      expect(settlement.extra?.lumenbazaar.receiptId).toMatch(/^receipt_attempt_playground_/);
    });
  });
});
