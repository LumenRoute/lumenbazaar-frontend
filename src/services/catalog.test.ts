import { describe, expect, it } from "vitest";

import { demoResources } from "@/fixtures/lumenbazaar";
import type { SearchResult } from "@/services/api/schemas";

import { searchCatalog, sortResources } from "./catalog";

function liveResult(resources: SearchResult["resources"] = []): SearchResult {
  return {
    nextCursor: null,
    partialResults: false,
    ranking: { strategy: "backend-search" },
    resources
  };
}

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

  it.each(["local", "testnet", "mainnet"] as const)(
    "never returns fixtures when a %s backend request fails",
    async (mode) => {
      const failure = new Error("offline");

      await expect(
        searchCatalog(
          { q: "weather" },
          {
            searchResources: async () => {
              throw failure;
            }
          },
          mode
        )
      ).rejects.toBe(failure);
    }
  );

  it("returns only backend resources and applies the requested sort in live mode", async () => {
    const cheaper = {
      ...demoResources[0]!,
      amount: "0.0100000",
      id: "resource_live_cheap",
      name: "Live Cheap",
      ranking: { matchedTerms: ["weather"], score: 2 }
    };
    const pricier = {
      ...demoResources[1]!,
      amount: "0.5000000",
      id: "resource_live_pricier",
      name: "Live Pricier",
      ranking: { matchedTerms: ["weather"], score: 1 }
    };

    const result = await searchCatalog(
      { q: "weather", sort: "price-asc" },
      {
        searchResources: async () => liveResult([pricier, cheaper])
      },
      "testnet"
    );

    expect(result.source).toBe("api");
    expect(result.resources.map((resource) => resource.id)).toEqual([
      "resource_live_cheap",
      "resource_live_pricier"
    ]);
    expect(result.resources.some((resource) => resource.id === "resource_weather_lagos")).toBe(
      false
    );
  });

  it("forwards live filters to the backend search contract", async () => {
    let received: unknown;

    await searchCatalog(
      {
        cursor: "cursor_page_2",
        extension: "mcp",
        maxPrice: "0.20",
        minPrice: "0.05",
        network: "stellar:testnet",
        q: "weather",
        sellerVerification: "any",
        sort: "price-desc",
        type: "mcp"
      },
      {
        searchResources: async (query) => {
          received = query;
          return liveResult();
        }
      },
      "testnet"
    );

    expect(received).toEqual({
      cursor: "cursor_page_2",
      extension: "mcp",
      limit: 12,
      maxPrice: "0.20",
      minPrice: "0.05",
      network: "stellar:testnet",
      q: "weather",
      sellerVerified: undefined,
      type: "mcp"
    });
  });

  it("maps verified seller filters to the backend boolean", async () => {
    let received: unknown;

    await searchCatalog(
      { sellerVerification: "unverified" },
      {
        searchResources: async (query) => {
          received = query;
          return liveResult();
        }
      },
      "testnet"
    );

    expect(received).toMatchObject({ sellerVerified: false });
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
