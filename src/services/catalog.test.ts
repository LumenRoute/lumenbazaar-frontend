import { describe, expect, it } from "vitest";

import { demoResources } from "@/fixtures/lumenbazaar";

import { searchCatalog, sortResources } from "./catalog";

describe("catalog search", () => {
  it("searches local fixtures only in explicit demo mode", async () => {
    const result = await searchCatalog(
      { q: "weather" },
      {
        searchResources: async () => Promise.reject(new Error("offline"))
      },
      "demo"
    );

    expect(result.source).toBe("demo");
    expect(result.resources).toHaveLength(1);
    expect(result.resources[0]?.id).toBe("resource_weather_lagos");
  });

  it("does not fall back to fixtures when a live-mode backend is unavailable", async () => {
    await expect(
      searchCatalog(
        { q: "weather" },
        { searchResources: async () => Promise.reject(new Error("offline")) },
        "testnet"
      )
    ).rejects.toThrow("offline");
  });

  it("sorts resources by price", () => {
    const sorted = sortResources(demoResources, "price-desc");

    expect(sorted[0]?.amount).toBe("0.1200000");
  });

  it("applies local filter state in demo mode", async () => {
    const result = await searchCatalog(
      {
        extension: "mcp",
        maxPrice: "0.20",
        minPrice: "0.10",
        network: "stellar:testnet",
        sellerVerification: "unverified",
        type: "mcp"
      },
      {
        searchResources: async () => Promise.reject(new Error("offline"))
      },
      "demo"
    );

    expect(result.resources.map((resource) => resource.id)).toEqual(["resource_stellar_rag"]);
  });
});
