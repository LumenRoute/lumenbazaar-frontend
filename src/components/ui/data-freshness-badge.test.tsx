import { describe, expect, it } from "vitest";

import { dataFreshnessState } from "./data-freshness-badge";

describe("dataFreshnessState", () => {
  const observedAt = "2026-10-07T12:00:00.000Z";

  it("distinguishes fresh, stale, and explicit demo observations", () => {
    expect(dataFreshnessState(observedAt, "api", Date.parse(observedAt) + 30_000)).toBe("fresh");
    expect(dataFreshnessState(observedAt, "partial", Date.parse(observedAt) + 90_000)).toBe(
      "stale"
    );
    expect(dataFreshnessState(observedAt, "demo", Date.parse(observedAt) + 90_000)).toBe("demo");
  });

  it("treats invalid observation timestamps as stale", () => {
    expect(dataFreshnessState("invalid", "api", Date.parse(observedAt))).toBe("stale");
  });
});
