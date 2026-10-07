import { describe, expect, it } from "vitest";

import { loadSellerDashboard } from "./seller-dashboard";

describe("seller dashboard", () => {
  it("summarizes seller identity, resources, and recent payments", () => {
    const dashboard = loadSellerDashboard("seller_atlas_weather", "demo");

    expect(dashboard.identityStatus).toBe("connected");
    expect(dashboard.verificationStatus).toBe("verified");
    expect(dashboard.resourceCount).toBe(1);
    expect(dashboard.recentPayments).toHaveLength(1);
  });

  it("rejects fixture seller data outside demo mode", () => {
    expect(() => loadSellerDashboard("seller_atlas_weather", "testnet")).toThrow(
      "Bundled fixtures"
    );
  });
});
