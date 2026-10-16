import { describe, expect, it } from "vitest";

import { demoResources } from "@/fixtures/lumenbazaar";
import { type ApiClientError } from "@/services/api/client";

import { buildPaymentRequirement, loadResourceDetail } from "./resource-detail";

describe("resource detail loader", () => {
  it("loads local resource details only in explicit demo mode", async () => {
    const detail = await loadResourceDetail(
      "resource_weather_lagos",
      {
        getResource: async () => Promise.reject(new Error("offline"))
      },
      "demo"
    );

    expect(detail.source).toBe("demo");
    expect(detail.resource.name).toBe("Paid Weather API");
    expect(detail.receipts).toHaveLength(1);
  });

  it("uses an API resource when the backend returns one", async () => {
    const detail = await loadResourceDetail(
      "resource_api",
      {
        getResource: async () => ({
          ...demoResources[0]!,
          id: "resource_api"
        })
      },
      "testnet"
    );

    expect(detail.source).toBe("api");
    expect(detail.resource.id).toBe("resource_api");
    expect(detail.receipts).toEqual([]);
  });

  it("derives exact payment requirements from resource terms", () => {
    const requirement = buildPaymentRequirement(demoResources[0]!);

    expect(requirement).toMatchObject({
      amount: "0.0500000",
      assetCode: "USDC",
      network: "stellar:testnet"
    });
  });

  it("never uses demo fallback after a live API failure", async () => {
    await expect(
      loadResourceDetail(
        "resource_weather_lagos",
        { getResource: async () => Promise.reject(new Error("offline")) },
        "testnet"
      )
    ).rejects.toMatchObject({
      code: "UNKNOWN_ERROR"
    });
  });

  describe("API error handling", () => {
    it("propagates 404 errors as NOT_FOUND", async () => {
      const notFoundError: ApiClientError = {
        name: "ApiClientError",
        code: "RESOURCE_NOT_FOUND",
        message: "Resource not found",
        status: 404,
        details: undefined,
        requestId: "req-123"
      } as ApiClientError;

      await expect(
        loadResourceDetail(
          "nonexistent_resource",
          { getResource: async () => Promise.reject(notFoundError) },
          "testnet"
        )
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Resource not found"
      });
    });

    it("propagates 503 service unavailable errors as SERVICE_UNAVAILABLE", async () => {
      const unavailableError: ApiClientError = {
        name: "ApiClientError",
        code: "UNSUPPORTED_CAPABILITY",
        message: "Backend is not ready for x402 v2 exact payments on stellar:testnet.",
        status: 503,
        details: undefined,
        requestId: "req-456"
      } as ApiClientError;

      const error = await loadResourceDetail(
        "resource_api",
        { getResource: async () => Promise.reject(unavailableError) },
        "testnet"
      ).catch((e) => e);

      expect(error).toMatchObject({
        code: "SERVICE_UNAVAILABLE",
        requestId: "req-456"
      });
    });

    it("propagates INVALID_API_RESPONSE errors with INVALID_RESPONSE code", async () => {
      const invalidError: ApiClientError = {
        name: "ApiClientError",
        code: "INVALID_API_RESPONSE",
        message: "The backend returned an invalid response for /v1/resources/123.",
        status: 200,
        details: { issues: [] },
        requestId: "req-789"
      } as ApiClientError;

      const error = await loadResourceDetail(
        "resource_api",
        { getResource: async () => Promise.reject(invalidError) },
        "testnet"
      ).catch((e) => e);

      expect(error).toMatchObject({
        code: "INVALID_RESPONSE",
        requestId: "req-789"
      });
    });

    it("handles network timeout errors as UNKNOWN_ERROR", async () => {
      const timeoutError: ApiClientError = {
        name: "ApiClientError",
        code: "BACKEND_UNAVAILABLE",
        message: "The LumenBazaar backend is unavailable.",
        status: 0,
        details: undefined,
        requestId: undefined
      } as ApiClientError;

      const error = await loadResourceDetail(
        "resource_api",
        { getResource: async () => Promise.reject(timeoutError) },
        "testnet"
      ).catch((e) => e);

      expect(error).toMatchObject({
        code: "UNKNOWN_ERROR",
        message: "The LumenBazaar backend is unavailable."
      });
    });

    it("handles malformed error responses gracefully", async () => {
      const malformedError = new SyntaxError("JSON parse error");

      const error = await loadResourceDetail(
        "resource_api",
        { getResource: async () => Promise.reject(malformedError) },
        "testnet"
      ).catch((e) => e);

      expect(error).toMatchObject({
        code: "UNKNOWN_ERROR",
        message: "JSON parse error"
      });
    });
  });

  describe("live mode fixture separation", () => {
    it("never includes demo receipts in live API response", async () => {
      const detail = await loadResourceDetail(
        "resource_weather_lagos",
        {
          getResource: async () => ({
            ...demoResources[0]!,
            id: "resource_weather_lagos"
          })
        },
        "testnet"
      );

      expect(detail.receipts).toHaveLength(0);
    });

    it("never includes seller data in live API response", async () => {
      const detail = await loadResourceDetail(
        "resource_weather_lagos",
        {
          getResource: async () => ({
            ...demoResources[0]!,
            id: "resource_weather_lagos"
          })
        },
        "testnet"
      );

      expect(detail.seller).toBeUndefined();
    });
  });

  describe("demo mode fixture inclusion", () => {
    it("includes demo receipts in demo mode response", async () => {
      const detail = await loadResourceDetail(
        "resource_weather_lagos",
        { getResource: async () => Promise.reject(new Error("should not be called")) },
        "demo"
      );

      expect(detail.receipts).toHaveLength(1);
      expect(detail.receipts[0]?.id).toBe("receipt_weather_001");
    });

    it("includes seller data in demo mode response", async () => {
      const detail = await loadResourceDetail(
        "resource_weather_lagos",
        { getResource: async () => Promise.reject(new Error("should not be called")) },
        "demo"
      );

      expect(detail.seller).toBeDefined();
      expect(detail.seller?.id).toBe("seller_atlas_weather");
    });

    it("throws NOT_FOUND error for missing demo resource", async () => {
      const error = await loadResourceDetail(
        "nonexistent_demo_resource",
        { getResource: async () => Promise.reject(new Error("should not be called")) },
        "demo"
      ).catch((e) => e);

      expect(error).toMatchObject({
        code: "NOT_FOUND"
      });
    });
  });
});
