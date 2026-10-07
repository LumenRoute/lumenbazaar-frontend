import { describe, expect, it, vi } from "vitest";

import { assertBackendCompatibility, LumenBazaarApiClient } from "./client";
import { readinessSchema, supportedSchema, versionSchema } from "./schemas";

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
      fetchImpl: fetchImpl as unknown as typeof fetch,
      validateCompatibility: false
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
      fetchImpl: fetchImpl as unknown as typeof fetch,
      validateCompatibility: false
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

  it("loads a seller resource collection from the scoped API route", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        nextCursor: null,
        resources: []
      })
    );
    const client = new LumenBazaarApiClient({
      baseUrl: "https://api.example.test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      validateCompatibility: false
    });

    const page = await client.listSellerResources("seller/live", {
      network: "stellar:testnet",
      status: "active"
    });
    const calls = fetchImpl.mock.calls as unknown as Array<[string, RequestInit]>;
    const url = new URL(String(calls[0]?.[0]));

    expect(url.pathname).toBe("/v1/sellers/seller%2Flive/resources");
    expect(url.searchParams.get("network")).toBe("stellar:testnet");
    expect(url.searchParams.get("status")).toBe("active");
    expect(page.resources).toEqual([]);
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
      fetchImpl: fetchImpl as unknown as typeof fetch,
      validateCompatibility: false
    });

    await expect(client.getResource("missing")).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
      requestId: "req_test",
      status: 404
    });
  });

  it("converts transport failures into an unavailable backend state", async () => {
    const client = new LumenBazaarApiClient({
      baseUrl: "https://api.example.test",
      fetchImpl: (() => Promise.reject(new Error("offline"))) as typeof fetch,
      validateCompatibility: false
    });

    await expect(client.getHealth()).rejects.toMatchObject({
      code: "BACKEND_UNAVAILABLE",
      status: 0
    });
  });

  it("rejects response schema drift with a stable client error", async () => {
    const client = new LumenBazaarApiClient({
      baseUrl: "https://api.example.test",
      fetchImpl: (async () => Response.json({ ok: "yes" })) as typeof fetch,
      validateCompatibility: false
    });

    await expect(client.getHealth()).rejects.toMatchObject({
      code: "INVALID_API_RESPONSE",
      status: 200
    });
  });

  it("rejects unsupported backend versions and capability combinations", () => {
    expect(() =>
      assertBackendCompatibility({
        expectedNetwork: "stellar:testnet",
        mode: "testnet",
        readiness: validReadiness(),
        supported: validSupported(),
        version: versionSchema.parse({
          environment: "testnet",
          service: "lumenbazaar-backend",
          version: "0.2.0"
        })
      })
    ).toThrow("unsupported");

    expect(() =>
      assertBackendCompatibility({
        expectedNetwork: "stellar:testnet",
        mode: "testnet",
        readiness: readinessSchema.parse({
          ...validReadiness(),
          capabilities: { exact: false, upto: false }
        }),
        supported: validSupported(),
        version: validVersion()
      })
    ).toThrow("not ready");
  });

  it("rejects the previous v1 supported schema", () => {
    expect(
      supportedSchema.safeParse({
        extensions: { bazaar: true },
        schemes: [{ name: "exact", network: "stellar:testnet" }]
      }).success
    ).toBe(false);
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
      fetchImpl: fetchImpl as unknown as typeof fetch,
      validateCompatibility: false
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
          extra: {
            lumenbazaar: {
              adapter: "@x402/stellar",
              correlationId: "corr_1",
              network: "stellar:testnet",
              paymentAttemptId: "attempt_1",
              paymentHash: "hash_1",
              status: "verified"
            }
          },
          isValid: true
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          amount: "500000",
          extra: {
            lumenbazaar: {
              correlationId: "corr_1",
              ledger: 456,
              paymentAttemptId: "attempt_1",
              receiptId: "receipt_1",
              settlementId: "settlement_1",
              status: "confirmed",
              transactionHash: "tx_1"
            }
          },
          network: "stellar:testnet",
          success: true,
          transaction: "tx_1"
        })
      );
    const client = new LumenBazaarApiClient({
      baseUrl: "https://api.example.test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      validateCompatibility: false
    });
    const request = paymentPayload();

    await client.verifyPayment(request);
    await client.settlePayment(request);

    const calls = fetchImpl.mock.calls as unknown as Array<[string, RequestInit]>;

    expect(calls[0]?.[0]).toBe("https://api.example.test/v1/verify");
    expect(JSON.parse(String(calls[0]?.[1].body))).toMatchObject({
      paymentPayload: {
        accepted: {
          scheme: "exact"
        },
        x402Version: 2
      },
      paymentRequirements: {
        scheme: "exact"
      }
    });
    expect(calls[1]?.[0]).toBe("https://api.example.test/v1/settle");
    expect(JSON.parse(String(calls[1]?.[1].body))).toMatchObject({ x402Version: 2 });
  });

  it("reads latest conformance from the persisted run list", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json([
        {
          completedAt: "2026-09-02T16:05:00.000Z",
          createdAt: "2026-09-02T16:05:00.000Z",
          exactResults: 3,
          failedCount: 0,
          id: "conformance_run_1",
          network: "stellar:testnet",
          passedCount: 3,
          reservedCount: 3,
          results: [
            {
              description: "Exact support is advertised.",
              durationMs: 14,
              endpoint: "/v1/supported",
              id: "exact-supported",
              method: "GET",
              name: "GET /v1/supported returns exact scheme",
              network: "stellar:testnet",
              passed: true,
              scheme: "exact",
              status: "passed"
            }
          ],
          startedAt: "2026-09-02T16:04:30.000Z",
          status: "passed",
          suite: "stellar-x402"
        }
      ])
    );
    const client = new LumenBazaarApiClient({
      baseUrl: "https://api.example.test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      validateCompatibility: false
    });

    const latest = await client.getLatestConformanceRun();
    const calls = fetchImpl.mock.calls as unknown as Array<[string, RequestInit]>;
    const url = new URL(String(calls[0]?.[0]));

    expect(url.pathname).toBe("/v1/conformance/runs");
    expect(url.searchParams.get("limit")).toBe("1");
    expect(latest.id).toBe("conformance_run_1");
  });

  it("parses supported exact and upto schemes", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        extensions: ["bazaar"],
        kinds: [
          {
            extra: {
              areFeesSponsored: true,
              assets: [
                {
                  code: "USDC",
                  contractId: "CASSET",
                  decimals: 7,
                  issuer: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
                }
              ]
            },
            network: "stellar:testnet",
            scheme: "exact",
            x402Version: 2
          },
          {
            extra: {
              contractId: "CCAPPEDSESSION",
              sessionEndpoint: "/v1/payment-sessions"
            },
            network: "stellar:testnet",
            scheme: "upto",
            x402Version: 2
          }
        ],
        signers: {
          "stellar:*": ["GFACILITATOR"]
        }
      })
    );
    const client = new LumenBazaarApiClient({
      baseUrl: "https://api.example.test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      validateCompatibility: false
    });

    const supported = await client.getSupported();

    expect(supported.kinds.map((kind) => kind.scheme)).toEqual(["exact", "upto"]);
    expect(supported.extensions).toEqual(["bazaar"]);
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
  const requirements = {
    amount: "500000",
    asset: "CASSET",
    extra: {
      assetCode: "USDC"
    },
    maxTimeoutSeconds: 300,
    network: "stellar:testnet" as const,
    payTo: "GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE",
    scheme: "exact" as const
  };

  return {
    paymentPayload: {
      accepted: requirements,
      payload: {
        transaction: "AAAA"
      },
      x402Version: 2 as const
    },
    paymentRequirements: requirements,
    x402Version: 2 as const
  };
}

function validReadiness() {
  const ready = { status: "ready" };
  return readinessSchema.parse({
    capabilities: { exact: true, upto: false },
    checks: {
      assets: ready,
      database: ready,
      horizon: ready,
      migrations: ready,
      redis: ready,
      signer: ready,
      stellarRpc: ready
    },
    environment: "testnet",
    ok: true
  });
}

function validSupported() {
  return supportedSchema.parse({
    extensions: ["bazaar"],
    kinds: [
      {
        extra: { assets: [] },
        network: "stellar:testnet",
        scheme: "exact",
        x402Version: 2
      }
    ],
    signers: { "stellar:*": ["GFACILITATOR"] }
  });
}

function validVersion() {
  return versionSchema.parse({
    environment: "testnet",
    service: "lumenbazaar-backend",
    version: "0.1.0"
  });
}
