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
});
