import { describe, expect, it } from "vitest";

import {
  explorerTransactionUrl,
  formatPaymentAmount,
  loadPaymentActivity,
  loadSellerPaymentActivity,
  loadSellerResources,
  paymentActivityStatus,
  shortHash
} from "./payments";

describe("payment activity services", () => {
  it("loads seller resources with filters", () => {
    expect(loadSellerResources({ sellerId: "seller_atlas_weather" })).toHaveLength(1);
    expect(
      loadSellerResources({
        sellerId: "seller_atlas_weather",
        status: "active",
        type: "http"
      })[0]?.name
    ).toBe("Paid Weather API");
    expect(loadSellerResources({ sellerId: "seller_atlas_weather", type: "mcp" })).toHaveLength(0);
  });

  it("joins attempts with resources, receipts, and settlements", () => {
    const activity = loadSellerPaymentActivity("seller_atlas_weather");

    expect(activity).toHaveLength(2);
    expect(activity.some((item) => item.receipt?.id === "receipt_weather_001")).toBe(true);
    expect(activity.map(paymentActivityStatus)).toContain("settled");
    expect(activity.map(paymentActivityStatus)).toContain("failed");
  });

  it("filters transaction activity by status and network", () => {
    expect(loadPaymentActivity({ network: "stellar:testnet", status: "verified" })).toHaveLength(1);
    expect(loadPaymentActivity({ asset: "USDC", resourceType: "mcp" })[0]?.resource?.type).toBe(
      "mcp"
    );
    expect(loadPaymentActivity({ date: "2026-09-02" })).toHaveLength(3);
    expect(loadPaymentActivity({ date: "2026-09-03" })).toHaveLength(0);
  });

  it("formats payment amounts and transaction links", () => {
    expect(formatPaymentAmount("0.0500000", "USDC")).toBe("0.0500 USDC");
    expect(shortHash("1234567890abcdef1234")).toBe("12345678...cdef1234");
    expect(explorerTransactionUrl("stellar:testnet", "tx_hash")).toBe(
      "https://stellar.expert/explorer/testnet/tx/tx_hash"
    );
  });
});
