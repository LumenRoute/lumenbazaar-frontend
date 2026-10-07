import { describe, expect, it } from "vitest";

import {
  explorerTransactionUrl,
  formatPaymentAmount,
  loadPaymentActivity,
  loadSellerPaymentActivity,
  loadSellerResourceSnapshot,
  loadSellerResources,
  paymentActivityStatus,
  shortHash
} from "./payments";

describe("payment activity services", () => {
  it("loads seller resources with filters", () => {
    expect(loadSellerResources({ sellerId: "seller_atlas_weather" }, "demo")).toHaveLength(1);
    expect(
      loadSellerResources(
        {
          sellerId: "seller_atlas_weather",
          status: "active",
          type: "http"
        },
        "demo"
      )[0]?.name
    ).toBe("Paid Weather API");
    expect(
      loadSellerResources({ sellerId: "seller_atlas_weather", type: "mcp" }, "demo")
    ).toHaveLength(0);
  });

  it("joins attempts with resources, receipts, and settlements", () => {
    const activity = loadSellerPaymentActivity("seller_atlas_weather", "demo");

    expect(activity).toHaveLength(2);
    expect(activity.some((item) => item.receipt?.id === "receipt_weather_001")).toBe(true);
    expect(activity.map(paymentActivityStatus)).toContain("settled");
    expect(activity.map(paymentActivityStatus)).toContain("failed");
  });

  it("filters transaction activity by status and network", () => {
    expect(
      loadPaymentActivity({ network: "stellar:testnet", status: "verified" }, "demo")
    ).toHaveLength(1);
    expect(
      loadPaymentActivity({ asset: "USDC", resourceType: "mcp" }, "demo")[0]?.resource?.type
    ).toBe("mcp");
    expect(loadPaymentActivity({ date: "2026-09-02" }, "demo")).toHaveLength(3);
    expect(loadPaymentActivity({ date: "2026-09-03" }, "demo")).toHaveLength(0);
  });

  it("rejects fixture activity outside demo mode", () => {
    expect(() => loadPaymentActivity({}, "local")).toThrow("Bundled fixtures");
  });

  it("uses the seller resource API in live mode and preserves an empty result", async () => {
    const client = {
      listSellerResources: vi.fn(async () => ({ nextCursor: null, resources: [] }))
    };

    const snapshot = await loadSellerResourceSnapshot(
      { sellerId: "seller_live", status: "active" },
      client,
      "testnet"
    );

    expect(client.listSellerResources).toHaveBeenCalledWith("seller_live", {
      asset: undefined,
      network: undefined,
      status: "active",
      type: undefined
    });
    expect(snapshot).toMatchObject({ resources: [], source: "api" });
    expect(snapshot.fetchedAt).toEqual(expect.any(String));
  });

  it("loads seller resource fixtures only in explicit demo mode", async () => {
    const client = {
      listSellerResources: vi.fn(async () => ({ nextCursor: null, resources: [] }))
    };

    const snapshot = await loadSellerResourceSnapshot(
      { sellerId: "seller_atlas_weather" },
      client,
      "demo"
    );

    expect(client.listSellerResources).not.toHaveBeenCalled();
    expect(snapshot.source).toBe("demo");
    expect(snapshot.resources).toHaveLength(1);
  });

  it("formats payment amounts and transaction links", () => {
    expect(formatPaymentAmount("0.0500000", "USDC")).toBe("0.0500 USDC");
    expect(shortHash("1234567890abcdef1234")).toBe("12345678...cdef1234");
    expect(explorerTransactionUrl("stellar:testnet", "tx_hash")).toBe(
      "https://stellar.expert/explorer/testnet/tx/tx_hash"
    );
  });
});
