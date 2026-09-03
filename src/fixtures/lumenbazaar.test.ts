import { describe, expect, it } from "vitest";

import {
  demoConformanceRun,
  demoDashboardMetrics,
  demoPaymentRequirements,
  demoReceipts,
  demoResources,
  demoSellers,
  findDemoResource,
  findDemoSeller
} from "./lumenbazaar";

describe("LumenBazaar fixtures", () => {
  it("provides demo resources, sellers, payment terms, receipts, and conformance data", () => {
    expect(demoResources).toHaveLength(2);
    expect(demoSellers).toHaveLength(2);
    expect(demoPaymentRequirements).toHaveLength(demoResources.length);
    expect(demoReceipts[0]?.status).toBe("finalized");
    expect(demoConformanceRun.status).toBe("passed");
  });

  it("supports lookup helpers for local UI development", () => {
    expect(findDemoResource("resource_weather_lagos")?.name).toBe("Paid Weather API");
    expect(findDemoSeller("seller_atlas_weather")?.domainVerifiedAt).not.toBeNull();
    expect(demoDashboardMetrics.indexedResourceCount).toBe(demoResources.length);
  });
});
