import { describe, expect, it } from "vitest";

import { demoResources } from "@/fixtures/lumenbazaar";

import { searchCatalog, sortResources } from "./catalog";

describe("catalog search", () => {
  it("searches local fixtures when the API is unavailable", async () => {
    const result = await searchCatalog(
      { q: "weather" },
      {
        searchResources: async () => Promise.reject(new Error("offline"))
      }
    );

    expect(result.source).toBe("demo");
    expect(result.resources).toHaveLength(1);
    expect(result.resources[0]?.id).toBe("resource_weather_lagos");
  });

  it("sorts resources by price", () => {
    const sorted = sortResources(demoResources, "price-desc");

    expect(sorted[0]?.amount).toBe("0.1200000");
  });
});
