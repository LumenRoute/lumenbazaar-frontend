import { describe, expect, it } from "vitest";

import { demoResources } from "@/fixtures/lumenbazaar";

import { loadResourceDetail } from "./resource-detail";

describe("resource detail loader", () => {
  it("falls back to local resource details when the API is unavailable", async () => {
    const detail = await loadResourceDetail("resource_weather_lagos", {
      getResource: async () => Promise.reject(new Error("offline"))
    });

    expect(detail.source).toBe("demo");
    expect(detail.resource.name).toBe("Paid Weather API");
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
});
