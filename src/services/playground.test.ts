import { describe, expect, it } from "vitest";

import { demoResources } from "@/fixtures/lumenbazaar";

import {
  buildPaymentRequiredPreview,
  buildPlaygroundPaymentRequest,
  buildSampleRequest,
  simulateSettlement,
  simulateVerification
} from "./playground";

describe("payment playground helpers", () => {
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
      currentLedger: 1,
      paymentPayload: {
        amount: resource.amount,
        authorization: {
          method: "simulation"
        },
        paymentHash: "payhash_test",
        scheme: "exact"
      },
      paymentRequirements: {
        amount: resource.amount,
        scheme: "exact"
      },
      resourceId: resource.id,
      sellerId: resource.sellerId
    });
  });

  it("builds 402 preview headers from selected resources", () => {
    const preview = buildPaymentRequiredPreview(demoResources[0]!);

    expect(preview.statusCode).toBe(402);
    expect(JSON.parse(preview.headers["x-payment-required"] ?? "{}")).toMatchObject({
      scheme: "exact",
      resourceId: "resource_weather_lagos"
    });
  });

  it("simulates verify and settle results with receipt evidence", () => {
    const request = buildPlaygroundPaymentRequest(demoResources[0]!, {
      paymentHash: "hash_demo"
    });
    const verification = simulateVerification(request);
    const settlement = simulateSettlement(request, verification);

    expect(verification).toMatchObject({
      paymentHash: "hash_demo",
      status: "verified"
    });
    expect(settlement).toMatchObject({
      paymentAttemptId: verification.paymentAttemptId,
      status: "settled"
    });
  });
});
