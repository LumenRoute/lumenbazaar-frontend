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

  it("serializes verify and settle requests with backend payment fields", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          adapter: "@x402/stellar",
          network: "stellar:testnet",
          paymentAttemptId: "attempt_1",
          paymentHash: "hash_1",
          status: "verified"
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          ledger: 456,
          network: "stellar:testnet",
          paymentAttemptId: "attempt_1",
          receiptId: "receipt_1",
          settlementId: "settlement_1",
          status: "settled",
          transactionHash: "tx_1"
        })
      );
    const client = new LumenBazaarApiClient({
      baseUrl: "https://api.example.test",
      fetchImpl: fetchImpl as unknown as typeof fetch
    });
    const request = paymentPayload();

    await client.verifyPayment(request);
    await client.settlePayment({ ...request, paymentAttemptId: "attempt_1" });

    const calls = fetchImpl.mock.calls as unknown as Array<[string, RequestInit]>;

    expect(calls[0]?.[0]).toBe("https://api.example.test/v1/verify");
    expect(JSON.parse(String(calls[0]?.[1].body))).toMatchObject({
      paymentPayload: {
        scheme: "exact"
      },
      paymentRequirements: {
        scheme: "exact"
      }
    });
    expect(calls[1]?.[0]).toBe("https://api.example.test/v1/settle");
    expect(JSON.parse(String(calls[1]?.[1].body))).toMatchObject({
      paymentAttemptId: "attempt_1"
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

function paymentPayload() {
  return {
    currentLedger: 1,
    paymentPayload: {
      amount: "0.05",
      asset: {
        code: "USDC",
        issuer: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
      },
      authorization: {
        simulation: true
      },
      network: "stellar:testnet" as const,
      payTo: "GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE",
      scheme: "exact" as const
    },
    paymentRequirements: {
      amount: "0.05",
      asset: {
        code: "USDC",
        issuer: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
      },
      network: "stellar:testnet" as const,
      payTo: "GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE",
      scheme: "exact" as const
    }
  };
}
