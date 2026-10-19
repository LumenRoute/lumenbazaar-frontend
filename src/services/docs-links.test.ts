import { describe, expect, it } from "vitest";

import {
  DEFAULT_DOCS_ORIGIN,
  canonicalDocsRepo,
  docsLinks,
  docsOrigin,
  docsRoutes,
  resolveDocsOrigin,
  validateDocsLinkProbe
} from "./docs-links";

describe("documentation links", () => {
  it("links every card to the deployed docs origin", () => {
    expect(docsLinks).toHaveLength(8);

    for (const link of docsLinks) {
      const url = new URL(link.href);
      expect(url.origin).toBe(docsOrigin);
      expect(url.search).toBe("");
      expect(url.hash).toBe("");
    }
  });

  it("uses a canonical deployed route for every section", () => {
    const paths = docsLinks.map((link) => new URL(link.href).pathname);

    expect(paths).toEqual([
      docsRoutes.seller,
      docsRoutes.buyer,
      docsRoutes.agent,
      docsRoutes.mcp,
      docsRoutes.operator,
      docsRoutes.api,
      docsRoutes.contracts,
      docsRoutes.security
    ]);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("does not point at GitHub source trees or the repository root", () => {
    for (const link of docsLinks) {
      expect(link.href.startsWith(canonicalDocsRepo)).toBe(false);
      expect(link.href).not.toContain("/tree/");
      expect(new URL(link.href).pathname).not.toBe("/");
    }
  });

  it("resolves a configured origin and strips paths, queries, and fragments", () => {
    expect(resolveDocsOrigin(undefined)).toBe(DEFAULT_DOCS_ORIGIN);
    expect(resolveDocsOrigin("https://docs.example.com/base/path?preview=1#top")).toBe(
      "https://docs.example.com"
    );
    expect(resolveDocsOrigin("  https://docs.example.com  ")).toBe("https://docs.example.com");
  });

  it("fails closed to the canonical deployment for unsafe origins", () => {
    expect(resolveDocsOrigin("javascript:alert(1)")).toBe(DEFAULT_DOCS_ORIGIN);
    expect(resolveDocsOrigin("ftp://docs.example.com")).toBe(DEFAULT_DOCS_ORIGIN);
    expect(resolveDocsOrigin("not a url")).toBe(DEFAULT_DOCS_ORIGIN);
  });
});

describe("deployed docs link validation", () => {
  const base = `${docsOrigin}${docsRoutes.seller}`;

  it("accepts a 200 response at the requested path", () => {
    expect(
      validateDocsLinkProbe({
        requestedUrl: base,
        finalUrl: base,
        status: 200,
        body: "<title>Seller guide</title>"
      })
    ).toEqual([]);
  });

  it("accepts a trailing-slash normalisation", () => {
    expect(
      validateDocsLinkProbe({
        requestedUrl: base,
        finalUrl: `${base}/`,
        status: 200
      })
    ).toEqual([]);
  });

  it("rejects redirects to a missing page", () => {
    const errors = validateDocsLinkProbe({
      requestedUrl: base,
      finalUrl: `${docsOrigin}/404`,
      status: 200
    });

    expect(errors.join(" ")).toContain("missing page");
  });

  it("rejects 404 responses and soft-404 bodies", () => {
    expect(validateDocsLinkProbe({ requestedUrl: base, finalUrl: base, status: 404 })).toContain(
      "expected HTTP 200, received 404"
    );

    expect(
      validateDocsLinkProbe({
        requestedUrl: base,
        finalUrl: base,
        status: 200,
        body: "<title>Page Not Found</title>"
      })
    ).toContain("response body looks like a not-found page");
  });

  it("rejects redirects off the configured docs origin", () => {
    const errors = validateDocsLinkProbe({
      requestedUrl: base,
      finalUrl: `https://example.com${docsRoutes.seller}`,
      status: 200
    });

    expect(errors.join(" ")).toContain("off the docs origin");
  });
});
