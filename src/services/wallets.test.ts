import { describe, expect, it } from "vitest";

import { getNetworkConfig } from "@/config/networks";

import { isNetworkMismatch } from "./wallets";

describe("wallet service", () => {
  it("detects wallet network mismatch by passphrase", () => {
    expect(
      isNetworkMismatch(
        getNetworkConfig("stellar:pubnet").passphrase,
        getNetworkConfig("stellar:testnet").passphrase
      )
    ).toBe(true);
  });

  it("accepts the configured network passphrase", () => {
    expect(
      isNetworkMismatch(
        getNetworkConfig("stellar:testnet").passphrase,
        getNetworkConfig("stellar:testnet").passphrase
      )
    ).toBe(false);
  });
});
