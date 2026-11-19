import { describe, expect, it } from "vitest";
import { validateDocumentationLinks } from "@/services/docs-search";
import { docsLinks } from "@/services/docs-links";

/**
 * Documentation Link Validation Tests
 *
 * These tests verify that all documentation links in the index are valid and accessible.
 * This is run as part of the build/check process to catch broken links early.
 *
 * Usage:
 *   pnpm test -- tests/docs-link-validation.spec.ts
 */

describe("Documentation Link Validation", () => {
  it("all documentation links are properly formatted", () => {
    for (const link of docsLinks) {
      // Should be valid URLs
      expect(() => new URL(link.href)).not.toThrow();

      // Should point to GitHub canonical docs repo
      expect(link.href).toContain("github.com");
      expect(link.href).toContain("LumenRoute/lumenbazaar-docs");

      // Should have proper documentation category paths
      const validCategories = ["sellers", "buyers", "agents", "operators", "api", "contracts", "security"];
      const hasValidCategory = validCategories.some((cat) => link.href.includes(`/tree/main/${cat}`));
      expect(hasValidCategory).toBe(true);
    }
  });

  it("all documentation links are unique", () => {
    const hrefs = docsLinks.map((link) => link.href);
    const uniqueHrefs = new Set(hrefs);

    expect(uniqueHrefs.size).toBe(hrefs.length);
  });

  it("documentation manifest has all required categories", () => {
    const categories = new Set<string>();

    for (const link of docsLinks) {
      const match = link.href.match(/\/tree\/main\/([^/]+)/);
      if (match) {
        categories.add(match[1]);
      }
    }

    const requiredCategories = ["sellers", "buyers", "agents", "operators", "api", "contracts", "security"];
    const missingCategories = requiredCategories.filter((cat) => !categories.has(cat));

    expect(missingCategories).toHaveLength(0);
  });

  it("documentation links have proper metadata", () => {
    for (const link of docsLinks) {
      // Label should not be empty
      expect(link.label.length).toBeGreaterThan(0);

      // Description should not be empty
      expect(link.description.length).toBeGreaterThan(0);

      // Icon should be a function (Lucide React icon)
      expect(typeof link.icon).toBe("function");
    }
  });

  it("validates documentation link accessibility", async () => {
    // This test runs asynchronously to check if links are accessible
    // Note: This may be skipped in CI if network access is restricted
    const brokenLinks = await validateDocumentationLinks();

    // Log broken links if any are found
    if (brokenLinks.length > 0) {
      console.warn("Broken documentation links detected:");
      for (const link of brokenLinks) {
        console.warn(`  - ${link.url}: ${link.error}`);
      }
    }

    // All links should be valid (this may be relaxed depending on network conditions)
    // In CI environments, this test might need to be skipped
    if (process.env.CI !== "true") {
      expect(brokenLinks).toHaveLength(0);
    }
  });

  it("documentation descriptions contain actionable content", () => {
    const goodDescriptions = [
      "Seller",
      "Buyer",
      "Agent",
      "Operator",
      "Backend",
      "Soroban",
      "Security",
      "wallet",
      "payment",
    ];

    for (const link of docsLinks) {
      const hasActionableContent = goodDescriptions.some((keyword) =>
        link.description.toLowerCase().includes(keyword.toLowerCase())
      );

      expect(hasActionableContent).toBe(true);
    }
  });

  it("verifies all categories have corresponding documentation", () => {
    const categoryLabels: Record<string, string> = {
      sellers: "Seller docs",
      buyers: "Buyer docs",
      agents: "Agent docs",
      operators: "Operator docs",
      api: "API docs",
      contracts: "Contract docs",
      security: "Security docs",
    };

    for (const [category, expectedLabel] of Object.entries(categoryLabels)) {
      const link = docsLinks.find((l) => l.href.includes(`/tree/main/${category}`));
      expect(link).toBeTruthy();
      expect(link?.label).toBe(expectedLabel);
    }
  });

  describe("Canonical Docs Repository", () => {
    it("uses consistent GitHub URL format", () => {
      const canonicalRepo = "https://github.com/LumenRoute/lumenbazaar-docs";

      for (const link of docsLinks) {
        expect(link.href.startsWith(canonicalRepo)).toBe(true);
      }
    });

    it("uses tree/main branch for all links", () => {
      for (const link of docsLinks) {
        expect(link.href).toContain("/tree/main/");
      }
    });

    it("does not link to default branch", () => {
      for (const link of docsLinks) {
        // Should not reference 'blob' (file links) only 'tree' (directory links)
        expect(link.href).not.toContain("/blob/");
        // Should not be raw GitHub content
        expect(link.href).not.toContain("raw.githubusercontent.com");
      }
    });
  });

  describe("Documentation Metadata Quality", () => {
    it("all descriptions are concise (under 150 chars)", () => {
      for (const link of docsLinks) {
        expect(link.description.length).toBeLessThan(150);
      }
    });

    it("all labels are concise (under 30 chars)", () => {
      for (const link of docsLinks) {
        expect(link.label.length).toBeLessThan(30);
      }
    });

    it("labels follow consistent naming pattern", () => {
      for (const link of docsLinks) {
        // Should end with 'docs'
        expect(link.label.toLowerCase()).toMatch(/docs$/);
        // Should be title case
        expect(link.label).toMatch(/^[A-Z]/);
      }
    });

    it("descriptions start with action verbs or nouns", () => {
      const validStartWords = [
        "Seller",
        "Buyer",
        "Agent",
        "Facilitator",
        "Backend",
        "Soroban",
        "Non-custodial",
        "Paid",
        "Payment",
      ];

      for (const link of docsLinks) {
        const firstWord = link.description.split(" ")[0];
        const isValid = validStartWords.some((word) =>
          firstWord.toLowerCase().includes(word.toLowerCase())
        );
        expect(isValid).toBe(true);
      }
    });
  });

  describe("Documentation Index Stability", () => {
    it("maintains stable link count", () => {
      // Should have exactly 7 documentation categories
      expect(docsLinks).toHaveLength(7);
    });

    it("maintains stable category order", () => {
      const expectedOrder = [
        "sellers",
        "buyers",
        "agents",
        "operators",
        "api",
        "contracts",
        "security",
      ];

      for (let i = 0; i < expectedOrder.length; i++) {
        const category = expectedOrder[i];
        expect(docsLinks[i].href).toContain(`/tree/main/${category}`);
      }
    });

    it("prevents accidental modifications to manifest", () => {
      // Verify each link has all required properties
      for (const link of docsLinks) {
        expect(link).toHaveProperty("label");
        expect(link).toHaveProperty("description");
        expect(link).toHaveProperty("href");
        expect(link).toHaveProperty("icon");
      }
    });
  });
});
