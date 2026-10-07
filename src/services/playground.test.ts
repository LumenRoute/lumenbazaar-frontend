import { describe, expect, it } from "vitest";

import { demoResources } from "@/fixtures/lumenbazaar";
import { paymentFlowStateLabels } from "@/services/api/schemas";

import {
  buildPaymentRequiredPreview,
  buildPlaygroundPaymentRequest,
  buildSampleRequest,
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

  it("simulates verify and settle results with receipt evidence", () => {
    const request = buildPlaygroundPaymentRequest(demoResources[0]!, {
      paymentHash: "hash_demo"
    });
    const verification = simulateVerification(request);
    const settlement = simulateSettlement(request, verification);

    expect(verification).toMatchObject({
      extra: {
        lumenbazaar: {
          paymentHash: "hash_demo",
          status: "verified"
        }
      },
      isValid: true
    });
    expect(settlement).toMatchObject({
      extra: {
        lumenbazaar: {
          paymentAttemptId: verification.extra?.lumenbazaar.paymentAttemptId,
          status: "confirmed"
        }
      },
      success: true
    });
  });
});
