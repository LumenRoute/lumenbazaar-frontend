import { describe, expect, it } from "vitest";

import { demoConformanceRun, demoSupportedPaymentSchemes } from "@/fixtures/lumenbazaar";

import { conformanceEndpointStatus, loadOperatorSnapshot } from "./operators";

describe("operator services", () => {
  it("combines verified live metadata without fixture metrics", async () => {
    const snapshot = await loadOperatorSnapshot(
      {
        async getHealth() {
          return {
            app: "api",
            ok: true,
            service: "lumenbazaar-backend"
          };
        },
        async getReadiness() {
          const ready = { status: "ready" as const };
          return {
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
            environment: "local",
            ok: true
          };
        },
        async getLatestConformanceRun() {
          return demoConformanceRun;
        },
        async getNetworks() {
          return {
            networks: [
              {
                assets: [
                  {
                    code: "USDC",
                    decimals: 7,
                    issuer: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
                  }
                ],
                displayName: "Stellar Testnet",
                horizonUrl: "https://horizon-testnet.stellar.org",
                id: "stellar:testnet" as const,
                passphrase: "Test SDF Network ; September 2015",
                rpcUrl: "https://soroban-testnet.stellar.org"
              }
            ]
          };
        },
        async getSupported() {
          return demoSupportedPaymentSchemes;
        }
      },
      "local"
    );

    expect(snapshot.source).toBe("api");
    expect(snapshot.healthRows.map((row) => row.name)).toContain("API");
    expect(snapshot.supported.kinds[0]?.scheme).toBe("exact");
    expect(snapshot.metrics.settlementSuccessRate).toBeNull();
  });

  it("does not fall back to demo operator data when backend sources fail", async () => {
    const failingClient = {
      getHealth: async () => Promise.reject(new Error("offline")),
      getLatestConformanceRun: async () => Promise.reject(new Error("offline")),
      getNetworks: async () => Promise.reject(new Error("offline")),
      getReadiness: async () => Promise.reject(new Error("offline")),
      getSupported: async () => Promise.reject(new Error("offline"))
    };

    await expect(loadOperatorSnapshot(failingClient, "testnet")).rejects.toThrow("offline");
  });

  it("uses fixtures when demo mode is explicit", async () => {
    const snapshot = await loadOperatorSnapshot(
      {
        getHealth: async () => Promise.reject(new Error("should not call")),
        getLatestConformanceRun: async () => Promise.reject(new Error("should not call")),
        getNetworks: async () => Promise.reject(new Error("should not call")),
        getReadiness: async () => Promise.reject(new Error("should not call")),
        getSupported: async () => Promise.reject(new Error("should not call"))
      },
      "demo"
    );

    expect(snapshot.source).toBe("demo");
    expect(snapshot.healthRows).toHaveLength(7);
    expect(snapshot.warnings).toEqual([]);
  });

  it("summarizes conformance endpoint status by result severity", () => {
    expect(conformanceEndpointStatus(demoConformanceRun, "/v1/supported")).toBe("passed");
    expect(conformanceEndpointStatus(demoConformanceRun, "/v1/payment-sessions")).toBe("reserved");
    expect(conformanceEndpointStatus(demoConformanceRun, "/v1/missing")).toBe("missing");
  });
});
