import { describe, expect, it, vi } from "vitest";

import { LumenBazaarApiClient } from "./client";

describe("LumenBazaarApiClient", () => {
  it("builds typed requests with correlation IDs", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        app: "api",
        dependencies: {
          database: "configured",
          redis: "configured"
        },
        ok: true,
        service: "lumenbazaar-backend"
      })
    );
    const client = new LumenBazaarApiClient({
      baseUrl: "https://api.example.test",
      fetchImpl: fetchImpl as unknown as typeof fetch
    });

    const health = await client.getHealth();

    expect(health.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.example.test/health",
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-request-id": expect.stringMatching(/^lumen-web-/)
        })
      })
    );
  });

  it("serializes resource search query parameters", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        nextCursor: null,
        partialResults: false,
        ranking: {
          strategy: "postgres-full-text-v1"
        },
        resources: []
      })
    );
    const client = new LumenBazaarApiClient({
      baseUrl: "https://api.example.test/",
      fetchImpl: fetchImpl as unknown as typeof fetch
    });

    await client.searchResources({
      asset: "USDC",
      limit: 10,
      network: "stellar:testnet",
      q: "weather",
      type: "http"
    });

    const calls = fetchImpl.mock.calls as unknown as Array<[string, RequestInit]>;
    const [url] = calls[0] ?? [];
    const requestUrl = new URL(String(url));

    expect(requestUrl.pathname).toBe("/v1/discovery/search");
    expect(requestUrl.searchParams.get("asset")).toBe("USDC");
    expect(requestUrl.searchParams.get("limit")).toBe("10");
    expect(requestUrl.searchParams.get("network")).toBe("stellar:testnet");
    expect(requestUrl.searchParams.get("q")).toBe("weather");
    expect(requestUrl.searchParams.get("type")).toBe("http");
  });

  it("converts structured API failures into typed errors", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json(
        {
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: "Resource was not found."
          },
          ok: false,
          requestId: "req_test"
        },
        { status: 404 }
      )
    );
    const client = new LumenBazaarApiClient({
      baseUrl: "https://api.example.test",
      fetchImpl: fetchImpl as unknown as typeof fetch
    });

    await expect(client.getResource("missing")).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
      requestId: "req_test",
      status: 404
    });
  });

  it("wraps resource validation payloads as discovery metadata", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        ok: false,
        errors: [
          {
            code: "CATALOG_VALIDATION_FAILED",
            message: "Route is invalid.",
            path: ["resource", "routeTemplate"]
          }
        ],
        warnings: []
      })
    );
    const client = new LumenBazaarApiClient({
      baseUrl: "https://api.example.test",
      fetchImpl: fetchImpl as unknown as typeof fetch
    });

    const result = await client.validateResource(resourcePayload());
    const calls = fetchImpl.mock.calls as unknown as Array<[string, RequestInit]>;
    const [, init] = calls[0] ?? [];

    expect(init?.body).toBe(
      JSON.stringify({
        metadataVersion: 1,
        sellerId: "seller_1",
        resource: {
          name: "Paid Weather API",
          description: "Weather data.",
          type: "http",
          url: "https://seller.example/weather",
          routeTemplate: "/weather/{city}",
          network: "stellar:testnet",
          assetCode: "USDC",
          assetIssuer: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
          amount: "0.05",
          payTo: "GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE",
          inputSchema: {
            type: "object",
            properties: {}
          },
          outputSchema: {
            type: "object",
            properties: {}
          }
        }
      })
    );
    expect(result).toEqual({
      valid: false,
      errors: [
        {
          code: "CATALOG_VALIDATION_FAILED",
          field: "resource.routeTemplate",
          message: "Route is invalid."
        }
      ],
      warnings: []
    });
  });
});

function resourcePayload() {
  return {
    sellerId: "seller_1",
    name: "Paid Weather API",
    description: "Weather data.",
    type: "http" as const,
    url: "https://seller.example/weather",
    routeTemplate: "/weather/{city}",
    network: "stellar:testnet" as const,
    assetCode: "USDC",
    assetIssuer: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    amount: "0.05",
    payTo: "GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE",
    inputSchema: {
      type: "object",
      properties: {}
    },
    outputSchema: {
      type: "object",
      properties: {}
    }
  };
}
