import { describe, expect, it } from "vitest";

import { demoConformanceRun } from "@/fixtures/lumenbazaar";

import { formatDuration, loadDashboardSnapshot } from "./dashboard";

describe("dashboard snapshot", () => {
  it("uses available API data without inventing unsupported metrics", async () => {
    const snapshot = await loadDashboardSnapshot({
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
        return {
          ...demoConformanceRun,
          id: "api_run"
        };
      },
      async getNetworks() {
        return {
          networks: [
            {
              assets: [],
              displayName: "Stellar Testnet",
              horizonUrl: "https://horizon-testnet.stellar.org",
              id: "stellar:testnet" as const,
              passphrase: "Test SDF Network ; September 2015",
              rpcUrl: "https://soroban-testnet.stellar.org"
            }
          ]
        };
      },
      async listResources() {
        return {
          nextCursor: null,
          resources: []
        };
      }
    });

    expect(snapshot.source).toBe("api");
    expect(snapshot.metrics.indexedResourceCount).toBe(0);
    expect(snapshot.metrics.activeSellerCount).toBeNull();
    expect(snapshot.metrics.settledPaymentCount).toBeNull();
    expect(snapshot.metrics.apiUptimeSeconds).toBeNull();
    expect(snapshot.metrics.supportedNetworks).toEqual(["stellar:testnet"]);
  });

  it("returns an honest unavailable state when API calls fail", async () => {
    const failingClient = {
      getHealth: async () => Promise.reject(new Error("offline")),
      getLatestConformanceRun: async () => Promise.reject(new Error("offline")),
      getNetworks: async () => Promise.reject(new Error("offline")),
      listResources: async () => Promise.reject(new Error("offline"))
    };

    const snapshot = await loadDashboardSnapshot(failingClient);

    expect(snapshot.source).toBe("unavailable");
    expect(snapshot.metrics.indexedResourceCount).toBeNull();
    expect(snapshot.metrics.supportedNetworks).toEqual([]);
    expect(snapshot.metrics.latestConformanceStatus).toBe("unavailable");
    expect(snapshot.warnings.toSorted()).toEqual(
      ["resources", "health", "networks", "conformance"].toSorted()
    );
  });

  it("formats uptime durations for compact metric cards", () => {
    expect(formatDuration(98_400)).toBe("1d 3h");
  });
});
