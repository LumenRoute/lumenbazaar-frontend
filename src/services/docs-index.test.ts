import { describe, expect, it, beforeEach, afterEach } from "vitest";

import {
  buildDocumentationIndex,
  DocumentationIndex,
  DocumentationIndexEntry,
  getDocumentationIndex,
  resetDocumentationIndexCache,
} from "./docs-index";
import { docsLinks } from "./docs-links";

describe("Documentation Index Builder", () => {
  beforeEach(() => {
    resetDocumentationIndexCache();
  });

  afterEach(() => {
    resetDocumentationIndexCache();
  });

  it("builds a deterministic index from docsLinks manifest", () => {
    const index = buildDocumentationIndex();

    expect(index).toHaveProperty("version", 1);
    expect(index).toHaveProperty("generatedAt");
    expect(index).toHaveProperty("contentHash");
    expect(index).toHaveProperty("entries");
    expect(index.entries).toHaveLength(docsLinks.length);
  });

  it("generates valid ISO 8601 timestamps", () => {
    const index = buildDocumentationIndex();
    const timestamp = new Date(index.generatedAt);

    expect(timestamp.getTime()).toBeGreaterThan(0);
    expect(index.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("creates deterministic content hashes", () => {
    const index1 = buildDocumentationIndex();
    resetDocumentationIndexCache();
    const index2 = buildDocumentationIndex();

    expect(index1.contentHash).toBe(index2.contentHash);
  });

  it("extracts category from docsLinks hrefs", () => {
    const index = buildDocumentationIndex();
    const categoryMap: Record<string, string> = {};

    for (const entry of index.entries) {
      categoryMap[entry.label] = entry.category;
    }

    expect(categoryMap["Seller docs"]).toBe("sellers");
    expect(categoryMap["Buyer docs"]).toBe("buyers");
    expect(categoryMap["Agent docs"]).toBe("agents");
    expect(categoryMap["Operator docs"]).toBe("operators");
    expect(categoryMap["API docs"]).toBe("api");
    expect(categoryMap["Contract docs"]).toBe("contracts");
    expect(categoryMap["Security docs"]).toBe("security");
  });

  it("includes approved keywords for each category", () => {
    const index = buildDocumentationIndex();

    const sellerEntry = index.entries.find((e) => e.category === "sellers");
    expect(sellerEntry?.keywords).toContain("domain verification");
    expect(sellerEntry?.keywords).toContain("onboarding");

    const buyerEntry = index.entries.find((e) => e.category === "buyers");
    expect(buyerEntry?.keywords).toContain("payment requirements");
    expect(buyerEntry?.keywords).toContain("x402");

    const operatorEntry = index.entries.find((e) => e.category === "operators");
    expect(operatorEntry?.keywords).toContain("health check");
    expect(operatorEntry?.keywords).toContain("conformance");
  });

  it("builds searchable content combining label, description, and keywords", () => {
    const index = buildDocumentationIndex();

    for (const entry of index.entries) {
      expect(entry.searchableContent).toBeTruthy();
      expect(entry.searchableContent).toBe(entry.searchableContent.toLowerCase());

      // Verify it contains label and description content
      expect(entry.searchableContent).toContain(entry.label.toLowerCase());
      expect(entry.searchableContent).toContain(
        entry.description.toLowerCase().split(" ")[0]
      );
    }
  });

  it("maps icon constructors to string names", () => {
    const index = buildDocumentationIndex();

    for (const entry of index.entries) {
      expect(entry.icon).toBeTruthy();
      expect(typeof entry.icon).toBe("string");
      expect(entry.icon.length).toBeGreaterThan(0);
    }
  });

  it("uses caching to return the same instance on repeated calls", () => {
    const index1 = getDocumentationIndex();
    const index2 = getDocumentationIndex();

    expect(index1).toBe(index2);
  });

  it("caches can be reset for testing", () => {
    const index1 = getDocumentationIndex();
    resetDocumentationIndexCache();
    const index2 = getDocumentationIndex();

    // Different instances but same content
    expect(index1).not.toBe(index2);
    expect(index1.contentHash).toBe(index2.contentHash);
  });

  it("preserves href from docsLinks in entries", () => {
    const index = buildDocumentationIndex();

    for (let i = 0; i < docsLinks.length; i++) {
      expect(index.entries[i].href).toBe(docsLinks[i].href);
    }
  });

  it("validates that all entries have required fields", () => {
    const index = buildDocumentationIndex();

    for (const entry of index.entries) {
      expect(entry.id).toBeTruthy();
      expect(entry.label).toBeTruthy();
      expect(entry.description).toBeTruthy();
      expect(entry.href).toBeTruthy();
      expect(entry.category).toBeTruthy();
      expect(entry.icon).toBeTruthy();
      expect(entry.searchableContent).toBeTruthy();
      expect(Array.isArray(entry.keywords)).toBe(true);
    }
  });

  it("maintains stable entry order matching docsLinks", () => {
    const index = buildDocumentationIndex();

    expect(index.entries).toHaveLength(docsLinks.length);

    for (let i = 0; i < docsLinks.length; i++) {
      expect(index.entries[i].label).toBe(docsLinks[i].label);
      expect(index.entries[i].href).toBe(docsLinks[i].href);
    }
  });

  describe("Index Interface Conformance", () => {
    it("conforms to DocumentationIndex interface", () => {
      const index = buildDocumentationIndex();

      const hasRequiredFields =
        typeof index.version === "number" &&
        typeof index.generatedAt === "string" &&
        typeof index.contentHash === "string" &&
        Array.isArray(index.entries);

      expect(hasRequiredFields).toBe(true);
    });

    it("each entry conforms to DocumentationIndexEntry interface", () => {
      const index = buildDocumentationIndex();

      for (const entry of index.entries) {
        const hasRequiredFields =
          typeof entry.id === "string" &&
          typeof entry.label === "string" &&
          typeof entry.description === "string" &&
          typeof entry.href === "string" &&
          typeof entry.category === "string" &&
          typeof entry.icon === "string" &&
          typeof entry.searchableContent === "string" &&
          Array.isArray(entry.keywords);

        expect(hasRequiredFields).toBe(true);
      }
    });
  });
});
