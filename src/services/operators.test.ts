import { describe, expect, it } from "vitest";

import { demoConformanceRun, demoSupportedPaymentSchemes } from "@/fixtures/lumenbazaar";

import { conformanceEndpointStatus, loadOperatorSnapshot } from "./operators";

describe("operator services", () => {
  it("combines live metadata with operator fallback metrics", async () => {
    const snapshot = await loadOperatorSnapshot({
      async getHealth() {
        return {
          app: "api",
          dependencies: {
            database: "configured",
            redis: "configured"
          },
          ok: true,
          service: "lumenbazaar-backend"
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
    });

    expect(snapshot.source).toBe("api");
    expect(snapshot.healthRows.map((row) => row.name)).toContain("API");
    expect(snapshot.supported.schemes[0]?.name).toBe("exact");
  });

  it("falls back to demo operator data when backend sources fail", async () => {
    const failingClient = {
      getHealth: async () => Promise.reject(new Error("offline")),
      getLatestConformanceRun: async () => Promise.reject(new Error("offline")),
      getNetworks: async () => Promise.reject(new Error("offline")),
      getSupported: async () => Promise.reject(new Error("offline"))
    };

    const snapshot = await loadOperatorSnapshot(failingClient);

    expect(snapshot.source).toBe("demo");
    expect(snapshot.healthRows).toHaveLength(7);
    expect(snapshot.warnings.toSorted()).toEqual(
      ["health", "networks", "supported", "conformance"].toSorted()
    );
  });

  it("summarizes conformance endpoint status by result severity", () => {
    expect(conformanceEndpointStatus(demoConformanceRun, "/v1/supported")).toBe("passed");
    expect(conformanceEndpointStatus(demoConformanceRun, "/v1/payment-sessions")).toBe("reserved");
    expect(conformanceEndpointStatus(demoConformanceRun, "/v1/missing")).toBe("missing");
  });
});
