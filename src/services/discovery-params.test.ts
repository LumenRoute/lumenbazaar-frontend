import { describe, expect, it } from "vitest";

import {
  canonicalDiscoveryState,
  discoveryHref,
  pagelessDiscoveryStateSchema,
  parseDiscoveryState,
  serializeDiscoveryState,
  toExploreSearchInput,
  type DiscoveryState
} from "./discovery-params";

describe("discovery URL state", () => {
  const completeState: DiscoveryState = {
    asset: "USDC",
    cursor: "cursor:page_2",
    extension: "mcp",
    maxPrice: "0.20",
    minPrice: "0.05",
    network: "stellar:testnet",
    q: "weather lagos",
    sellerVerification: "verified",
    sort: "price-asc",
    type: "http"
  };

  it("round-trips every supported filter, sort, and cursor through the URL", () => {
    const search = serializeDiscoveryState(completeState);
    const restored = parseDiscoveryState(new URLSearchParams(search));

    expect(restored).toEqual(completeState);
    expect(serializeDiscoveryState(restored)).toBe(search);
  });

  it("omits defaults so equivalent states share one canonical link", () => {
    expect(serializeDiscoveryState(parseDiscoveryState(undefined))).toBe("");
    expect(discoveryHref(parseDiscoveryState({ q: "  " }))).toBe("/explore");
    expect(serializeDiscoveryState(parseDiscoveryState({ sellerVerification: "any" }))).toBe("");
  });

  it("normalizes invalid values predictably", () => {
    const state = parseDiscoveryState({
      asset: "bad asset<script>",
      cursor: "x".repeat(1025),
      extension: "unknown",
      maxPrice: "0.01",
      minPrice: "0.50",
      network: "stellar:future",
      q: "   weather   ",
      sellerVerification: "probably",
      sort: "cheapest",
      type: "grpc"
    });

    expect(state).toEqual({
      minPrice: "0.50",
      q: "weather",
      sellerVerification: "any",
      sort: "relevance"
    });
    expect(state.maxPrice).toBeUndefined();
    expect(state.cursor).toBeUndefined();
    expect(state.network).toBeUndefined();
  });

  it("rejects malformed prices and cursors instead of forwarding them", () => {
    const state = parseDiscoveryState({
      cursor: "cursor with spaces",
      maxPrice: "free",
      minPrice: "-1"
    });

    expect(state.minPrice).toBeUndefined();
    expect(state.maxPrice).toBeUndefined();
    expect(state.cursor).toBeUndefined();
  });

  it("accepts only the supported network identifiers", () => {
    expect(parseDiscoveryState({ network: "stellar:pubnet" }).network).toBe("stellar:pubnet");
    expect(parseDiscoveryState({ network: "pubnet" }).network).toBeUndefined();
  });

  it("never serializes wallet or payment authorization fields", () => {
    const state = parseDiscoveryState({
      paymentPayload: "signed-xdr",
      q: "weather",
      sellerSession: "session-token",
      wallet: "GADDRESS"
    });

    expect(serializeDiscoveryState(state)).toBe("q=weather");
    expect(toExploreSearchInput(state)).not.toHaveProperty("wallet");
    expect(toExploreSearchInput(state)).not.toHaveProperty("paymentPayload");
  });

  it("canonicalizes in-memory drafts with the same rules as the URL parser", () => {
    const draft: DiscoveryState = {
      asset: "  USDC ",
      maxPrice: "0.01",
      minPrice: "0.5",
      q: "  weather ",
      sellerVerification: "any",
      sort: "bogus" as never
    };

    expect(canonicalDiscoveryState(draft)).toEqual(
      parseDiscoveryState(new URLSearchParams(serializeDiscoveryState(draft)))
    );
    expect(canonicalDiscoveryState(draft)).toMatchObject({
      asset: "USDC",
      minPrice: "0.5",
      q: "weather",
      sort: "relevance"
    });
    expect(canonicalDiscoveryState(draft).maxPrice).toBeUndefined();
  });

  it("accepts canonical pageless state and rejects anything a URL would read differently", () => {
    const pageless: Omit<DiscoveryState, "cursor"> = {
      asset: completeState.asset,
      extension: completeState.extension,
      maxPrice: completeState.maxPrice,
      minPrice: completeState.minPrice,
      network: completeState.network,
      q: completeState.q,
      sellerVerification: completeState.sellerVerification,
      sort: completeState.sort,
      type: completeState.type
    };

    expect(pagelessDiscoveryStateSchema.safeParse(pageless).success).toBe(true);
    expect(
      pagelessDiscoveryStateSchema.safeParse({ q: "", sellerVerification: "any", sort: "recent" })
        .success
    ).toBe(true);

    for (const invalid of [
      { ...pageless, cursor: "page_2" },
      { ...pageless, unknown: true },
      { ...pageless, q: " weather" },
      { ...pageless, sort: "cheapest" },
      { ...pageless, network: "stellar:futurenet" },
      { ...pageless, asset: "bad asset" },
      { ...pageless, minPrice: "1", maxPrice: "0.5" },
      { ...pageless, q: "q".repeat(201) },
      { q: "weather" }
    ]) {
      expect(pagelessDiscoveryStateSchema.safeParse(invalid).success).toBe(false);
    }
  });
});
