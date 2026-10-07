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
        },
        async getVersion() {
          return {
            commit: "abcdef1",
            environment: "local",
            service: "lumenbazaar-backend",
            version: "0.1.0"
          };
        }
      },
      "local"
    );

    expect(snapshot.source).toBe("api");
    expect(snapshot.healthRows.map((row) => row.name)).toContain("API");
    expect(snapshot.supported.kinds[0]?.scheme).toBe("exact");
    expect(snapshot.metrics.settlementSuccessRate).toBeNull();
    expect(snapshot.version?.commit).toBe("abcdef1");
    expect(snapshot.checkedAt).toEqual(expect.any(String));
  });

  it("does not fall back to demo operator data when backend sources fail", async () => {
    const failingClient = {
      getHealth: async () => Promise.reject(new Error("offline")),
      getLatestConformanceRun: async () => Promise.reject(new Error("offline")),
      getNetworks: async () => Promise.reject(new Error("offline")),
      getReadiness: async () => Promise.reject(new Error("offline")),
      getSupported: async () => Promise.reject(new Error("offline")),
      getVersion: async () => Promise.reject(new Error("offline"))
    };

    const snapshot = await loadOperatorSnapshot(failingClient, "testnet");

    expect(snapshot.source).toBe("unavailable");
    expect(snapshot.conformance).toBeNull();
    expect(snapshot.supported.kinds).toEqual([]);
    expect(snapshot.healthRows.every((row) => row.status === "unknown")).toBe(true);
  });

  it("uses fixtures when demo mode is explicit", async () => {
    const snapshot = await loadOperatorSnapshot(
      {
        getHealth: async () => Promise.reject(new Error("should not call")),
        getLatestConformanceRun: async () => Promise.reject(new Error("should not call")),
        getNetworks: async () => Promise.reject(new Error("should not call")),
        getReadiness: async () => Promise.reject(new Error("should not call")),
        getSupported: async () => Promise.reject(new Error("should not call")),
        getVersion: async () => Promise.reject(new Error("should not call"))
      },
      "demo"
    );

    expect(snapshot.source).toBe("demo");
    expect(snapshot.healthRows).toHaveLength(7);
    expect(snapshot.warnings).toEqual([]);
  });

  it("preserves fulfilled live checks during a partial outage", async () => {
    const snapshot = await loadOperatorSnapshot(
      {
        getHealth: async () => ({ app: "api", ok: true, service: "lumenbazaar-backend" }),
        getLatestConformanceRun: async () => Promise.reject(new Error("offline")),
        getNetworks: async () => ({ networks: [] }),
        getReadiness: async () => Promise.reject(new Error("offline")),
        getSupported: async () => ({ extensions: [], kinds: [], signers: {} }),
        getVersion: async () => ({
          environment: "testnet",
          service: "lumenbazaar-backend",
          version: "0.1.0"
        })
      },
      "testnet"
    );

    expect(snapshot.source).toBe("partial");
    expect(snapshot.healthRows.find((row) => row.name === "API")?.status).toBe("operational");
    expect(snapshot.healthRows.find((row) => row.name === "RPC")?.status).toBe("unknown");
    expect(snapshot.warnings).toContain("readiness");
  });

  it("summarizes conformance endpoint status by result severity", () => {
    expect(conformanceEndpointStatus(demoConformanceRun, "/v1/supported")).toBe("passed");
    expect(conformanceEndpointStatus(demoConformanceRun, "/v1/payment-sessions")).toBe("reserved");
    expect(conformanceEndpointStatus(demoConformanceRun, "/v1/missing")).toBe("missing");
  });
});
