import { describe, expect, it } from "vitest";

import { demoResources } from "@/fixtures/lumenbazaar";

import { buildPaymentRequirement, loadResourceDetail } from "./resource-detail";

describe("resource detail loader", () => {
  it("falls back to local resource details when the API is unavailable", async () => {
    const detail = await loadResourceDetail("resource_weather_lagos", {
      getResource: async () => Promise.reject(new Error("offline"))
    });

    expect(detail.source).toBe("demo");
    expect(detail.resource.name).toBe("Paid Weather API");
    expect(detail.requirement.scheme).toBe("exact");
    expect(detail.receipts).toHaveLength(1);
  });

  it("uses an API resource when the backend returns one", async () => {
    const detail = await loadResourceDetail("resource_api", {
      getResource: async () => ({
        ...demoResources[0]!,
        id: "resource_api"
      })
    });

    expect(detail.source).toBe("api");
    expect(detail.resource.id).toBe("resource_api");
    expect(detail.receipts).toEqual([]);
  });

  it("derives exact payment requirements from resource terms", () => {
    const requirement = buildPaymentRequirement(demoResources[0]!);

    expect(requirement).toMatchObject({
      amount: "0.0500000",
      assetCode: "USDC",
      network: "stellar:testnet",
      scheme: "exact",
      x402Version: "1"
    });
  });
});
