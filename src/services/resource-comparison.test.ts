import { describe, expect, it } from "vitest";

import { demoResources } from "@/fixtures/lumenbazaar";
import type { Resource } from "@/services/api/schemas";

import {
  buildResourceComparison,
  loadResourceComparison,
  maxComparisonResources,
  parseComparisonIds,
  schemaCompatibility
} from "./resource-comparison";

const weather = demoResources[0]!;
const rag = demoResources[1]!;

function resource(overrides: Partial<Resource>): Resource {
  return { ...weather, ...overrides };
}

describe("comparison ids", () => {
  it("deduplicates, validates, and bounds the selection", () => {
    expect(parseComparisonIds("a,b,a")).toEqual(["a", "b"]);
    expect(parseComparisonIds(["a,b", "bad id"])).toEqual(["a", "b"]);
    expect(parseComparisonIds(undefined)).toEqual([]);
    expect(parseComparisonIds(Array.from({ length: 9 }, (_, index) => `r${index}`))).toHaveLength(
      maxComparisonResources
    );
  });
});

describe("resource comparison", () => {
  it("uses live API records outside demo mode and never falls back to fixtures", async () => {
    const requested: string[] = [];
    const result = await loadResourceComparison(
      ["live_resource"],
      {
        getResource: async (id) => {
          requested.push(id);
          return resource({ id, name: "Live resource" });
        }
      },
      "testnet"
    );

    expect(requested).toEqual(["live_resource"]);
    expect(result.source).toBe("api");
    expect(result.columns[0]?.name).toBe("Live resource");
  });

  it("reports unavailable live records instead of substituting demo data", async () => {
    const result = await loadResourceComparison(
      ["missing"],
      {
        getResource: async () => Promise.reject(new Error("not found"))
      },
      "testnet"
    );

    expect(result.source).toBe("api");
    expect(result.columns).toEqual([]);
    expect(result.unavailableIds).toEqual(["missing"]);
  });

  it("uses fixtures only in explicit demo mode", async () => {
    const result = await loadResourceComparison(
      [weather.id, "unknown_resource"],
      {
        getResource: async () => Promise.reject(new Error("offline"))
      },
      "demo"
    );

    expect(result.source).toBe("demo");
    expect(result.columns.map((column) => column.id)).toEqual([weather.id]);
    expect(result.unavailableIds).toEqual(["unknown_resource"]);
  });

  it("keeps missing fields visibly unknown instead of guessing", () => {
    const comparison = buildResourceComparison([
      resource({ extensions: { trusted: true } }),
      resource({ extensions: {}, id: "resource_partial", name: "Partial resource" })
    ]);

    const contractRow = comparison.rows.find((row) => row.key === "assetContract");
    const verificationRow = comparison.rows.find((row) => row.key === "sellerVerification");

    expect(contractRow?.values).toEqual([null, null]);
    expect(verificationRow?.values).toEqual(["Verified", null]);
    expect(comparison.unknownFieldCount).toBeGreaterThan(0);
  });

  it("prominently flags network and asset contract differences", () => {
    const comparison = buildResourceComparison([
      resource({ extensions: { assetContract: "CAAAA" } }),
      resource({
        extensions: { assetContract: "CBBBB" },
        id: "other",
        network: "stellar:pubnet"
      })
    ]);

    expect(comparison.networkMismatch).toBe(true);
    expect(comparison.assetContractMismatch).toBe(true);
    expect(comparison.rows.find((row) => row.key === "network")?.prominent).toBe(true);
    expect(comparison.rows.find((row) => row.key === "assetContract")?.prominent).toBe(true);
  });

  it("labels incompatible schemas without an aggregate quality score", () => {
    const comparison = buildResourceComparison([
      weather,
      resource({ inputSchema: { type: "string" }, outputSchema: { type: "string" } })
    ]);

    expect(schemaCompatibility([weather, rag], "inputSchema")).toBe("incompatible");
    expect(comparison.schemaMismatch).toBe(true);
    expect(comparison.rows.find((row) => row.key === "inputSchema")?.values).toEqual([
      "Different",
      "Different"
    ]);
    expect(comparison).not.toHaveProperty("score");
  });

  it("treats empty schemas as unknown compatibility", () => {
    expect(schemaCompatibility([resource({ inputSchema: {} }), weather], "inputSchema")).toBe(
      "unknown"
    );
  });
});
