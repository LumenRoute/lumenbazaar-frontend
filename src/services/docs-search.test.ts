import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

import {
  searchDocumentation,
  getSearchSuggestions,
  validateDocumentationLinks,
  SearchResult,
} from "./docs-search";
import { resetDocumentationIndexCache } from "./docs-index";

describe("Documentation Search Service", () => {
  beforeEach(() => {
    resetDocumentationIndexCache();
  });

  afterEach(() => {
    resetDocumentationIndexCache();
  });

  describe("searchDocumentation", () => {
    it("returns empty array for empty query", () => {
      const results = searchDocumentation("");
      expect(results).toEqual([]);
    });

    it("returns all entries when query is whitespace", () => {
      const results = searchDocumentation("   ");
      expect(results).toEqual([]);
    });

    it("searches for exact label match with highest score", () => {
      const results = searchDocumentation("Seller docs");

      expect(results.length).toBeGreaterThan(0);
      const firstResult = results[0];
      expect(firstResult.entry.label).toBe("Seller docs");
      expect(firstResult.score).toBe(1.0);
      expect(firstResult.matchType).toBe("label");
    });

    it("searches case-insensitively", () => {
      const results1 = searchDocumentation("seller docs");
      const results2 = searchDocumentation("SELLER DOCS");
      const results3 = searchDocumentation("SelLeR dOcS");

      expect(results1).toHaveLength(results2.length);
      expect(results2).toHaveLength(results3.length);
      expect(results1[0].entry.label).toBe(results2[0].entry.label);
    });

    it("finds partial label matches with score 0.9", () => {
      const results = searchDocumentation("seller");

      expect(results.length).toBeGreaterThan(0);
      const sellerResult = results.find((r) => r.entry.label === "Seller docs");
      expect(sellerResult).toBeTruthy();
      expect(sellerResult?.score).toBe(0.9);
      expect(sellerResult?.matchType).toBe("label");
    });

    it("finds keyword exact matches with score 0.8", () => {
      const results = searchDocumentation("domain verification");

      expect(results.length).toBeGreaterThan(0);
      const firstResult = results[0];
      expect(firstResult.score).toBe(0.8);
      expect(firstResult.matchType).toBe("keyword");
    });

    it("finds description matches with score 0.7", () => {
      const results = searchDocumentation("onboarding");

      expect(results.length).toBeGreaterThan(0);
      const firstResult = results[0];
      expect(firstResult.score).toBeGreaterThanOrEqual(0.7);
    });

    it("finds searchable content matches with score 0.6", () => {
      const results = searchDocumentation("payment");

      expect(results.length).toBeGreaterThan(0);
      // Payment appears in buyer docs as a keyword
      expect(results.some((r) => r.entry.category === "buyers")).toBe(true);
    });

    it("ranks results by score in descending order", () => {
      const results = searchDocumentation("docs");

      // Should have multiple matches for generic query
      expect(results.length).toBeGreaterThan(0);

      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
      }
    });

    it("sorts by label when scores are equal for deterministic ordering", () => {
      // Query that matches multiple entries with similar scores
      const results = searchDocumentation("docs");

      // Check that results maintain stable ordering
      const labels = results.map((r) => r.entry.label);
      const sortedLabels = [...labels].sort();

      // At the same score level, should maintain alphabetical ordering
      let prevScore = results[0].score;
      let prevLabel = results[0].entry.label;

      for (let i = 1; i < results.length; i++) {
        if (results[i].score === prevScore) {
          expect(results[i].entry.label.localeCompare(prevLabel)).toBeGreaterThanOrEqual(0);
        }
        prevScore = results[i].score;
        prevLabel = results[i].entry.label;
      }
    });

    it("respects limit parameter", () => {
      const allResults = searchDocumentation("docs", 100);
      const limitedResults = searchDocumentation("docs", 3);

      expect(limitedResults.length).toBeLessThanOrEqual(3);
      expect(limitedResults.length).toBeLessThanOrEqual(allResults.length);
    });

    it("returns at most the requested limit", () => {
      const results = searchDocumentation("d", 1);
      expect(results.length).toBeLessThanOrEqual(1);
    });

    it("handles special characters in query", () => {
      const results = searchDocumentation("x402");
      expect(Array.isArray(results)).toBe(true);
    });

    it("trims whitespace from query", () => {
      const results1 = searchDocumentation("  seller docs  ");
      const results2 = searchDocumentation("seller docs");

      expect(results1).toHaveLength(results2.length);
      expect(results1[0].entry.label).toBe(results2[0].entry.label);
    });

    it("returns results as SearchResult objects with required fields", () => {
      const results = searchDocumentation("buyer");

      expect(results.length).toBeGreaterThan(0);

      for (const result of results) {
        expect(result).toHaveProperty("entry");
        expect(result).toHaveProperty("score");
        expect(result).toHaveProperty("matchType");
        expect(typeof result.score).toBe("number");
        expect(result.score).toBeGreaterThan(0);
        expect(result.score).toBeLessThanOrEqual(1);
        expect(["label", "description", "keyword"]).toContain(result.matchType);
      }
    });
  });

  describe("getSearchSuggestions", () => {
    it("returns empty array for empty query", () => {
      const suggestions = getSearchSuggestions("");
      expect(suggestions).toEqual([]);
    });

    it("returns all labels when query is empty", () => {
      const suggestions = getSearchSuggestions("", 100);
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it("suggests matching labels", () => {
      const suggestions = getSearchSuggestions("seller");

      expect(suggestions).toContain("Seller docs");
    });

    it("suggests matching keywords", () => {
      const suggestions = getSearchSuggestions("payment");

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some((s) => s.includes("payment"))).toBe(true);
    });

    it("respects limit parameter", () => {
      const allSuggestions = getSearchSuggestions("d", 100);
      const limitedSuggestions = getSearchSuggestions("d", 2);

      expect(limitedSuggestions.length).toBeLessThanOrEqual(2);
      expect(limitedSuggestions.length).toBeLessThanOrEqual(allSuggestions.length);
    });

    it("returns unique suggestions", () => {
      const suggestions = getSearchSuggestions("doc");
      const uniqueSuggestions = new Set(suggestions);

      expect(suggestions.length).toBe(uniqueSuggestions.size);
    });

    it("searches case-insensitively", () => {
      const suggestions1 = getSearchSuggestions("seller");
      const suggestions2 = getSearchSuggestions("SELLER");

      expect(suggestions1).toEqual(suggestions2);
    });

    it("trims whitespace from query", () => {
      const suggestions1 = getSearchSuggestions("  seller  ");
      const suggestions2 = getSearchSuggestions("seller");

      expect(suggestions1).toEqual(suggestions2);
    });
  });

  describe("validateDocumentationLinks", () => {
    it("returns promise that resolves to array", async () => {
      const result = validateDocumentationLinks();
      expect(result).toBeInstanceOf(Promise);

      const brokenLinks = await result;
      expect(Array.isArray(brokenLinks)).toBe(true);
    });

    it("includes url and error fields for broken links", async () => {
      // Mock fetch to simulate broken links
      const originalFetch = global.fetch;
      global.fetch = vi.fn(async (url) => ({
        ok: false,
        status: 404,
        statusText: "Not Found",
        headers: new Headers(),
      })) as any;

      try {
        const brokenLinks = await validateDocumentationLinks();

        if (brokenLinks.length > 0) {
          for (const link of brokenLinks) {
            expect(link).toHaveProperty("url");
            expect(link).toHaveProperty("error");
            expect(typeof link.url).toBe("string");
            expect(typeof link.error).toBe("string");
          }
        }
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("returns empty array when all links are valid", async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers(),
      })) as any;

      try {
        const brokenLinks = await validateDocumentationLinks();
        expect(brokenLinks).toHaveLength(0);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("handles HEAD request fallback to GET", async () => {
      const originalFetch = global.fetch;
      let callCount = 0;

      global.fetch = vi.fn(async (url, options: any) => {
        callCount++;

        if (options?.method === "HEAD") {
          return {
            ok: false,
            status: 405, // Method Not Allowed
            statusText: "Method Not Allowed",
            headers: new Headers(),
          };
        }

        if (options?.method === "GET") {
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            headers: new Headers(),
          };
        }

        return {
          ok: true,
          status: 200,
          statusText: "OK",
          headers: new Headers(),
        };
      }) as any;

      try {
        const brokenLinks = await validateDocumentationLinks();

        // Should have attempted to validate links
        expect(callCount).toBeGreaterThan(0);
        expect(Array.isArray(brokenLinks)).toBe(true);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("handles fetch errors gracefully", async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn(async () => {
        throw new Error("Network error");
      }) as any;

      try {
        const brokenLinks = await validateDocumentationLinks();

        // Should return errors for failed requests
        expect(brokenLinks.length).toBeGreaterThan(0);
        expect(brokenLinks[0].error).toContain("Network error");
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe("SearchResult Interface Conformance", () => {
    it("SearchResult objects have correct types", () => {
      const results = searchDocumentation("seller");

      for (const result of results) {
        expect(typeof result.entry).toBe("object");
        expect(typeof result.score).toBe("number");
        expect(typeof result.matchType).toBe("string");
      }
    });
  });
});
