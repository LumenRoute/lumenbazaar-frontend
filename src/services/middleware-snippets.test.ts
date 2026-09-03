import { describe, it, expect } from "vitest";
import {
  generateExpressSnippet,
  generateFastifySnippet,
  generateNextJsSnippet,
  generateSnippet,
  type MiddlewareFramework
} from "./middleware-snippets";
import { createEmptyDraft, updateDraft } from "./resource-creation";

describe("middleware snippet generation", () => {
  const draft = updateDraft(createEmptyDraft(), {
    name: "Test API",
    description: "Test resource",
    type: "http",
    url: "https://example.com",
    routeTemplate: "/weather/{city}",
    network: "stellar:testnet",
    assetCode: "USDC",
    assetIssuer: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    amount: "0.05",
    payTo: "GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE"
  });

  describe("Express snippet", () => {
    it("generates valid Express code", () => {
      const snippet = generateExpressSnippet(draft);

      expect(snippet).toContain("import express");
      expect(snippet).toContain("@lumenbazaar/seller-sdk");
      expect(snippet).toContain("resourceMetadata");
      expect(snippet).toContain(draft.name);
      expect(snippet).toContain(draft.amount);
    });

    it("includes route template", () => {
      const snippet = generateExpressSnippet(draft);
      expect(snippet).toContain("/weather/:param");
    });

    it("includes network configuration", () => {
      const snippet = generateExpressSnippet(draft);
      expect(snippet).toContain("stellar:testnet");
    });
  });

  describe("Fastify snippet", () => {
    it("generates valid Fastify code", () => {
      const snippet = generateFastifySnippet(draft);

      expect(snippet).toContain("import Fastify");
      expect(snippet).toContain("@lumenbazaar/seller-sdk");
      expect(snippet).toContain("LumenBazaarPlugin");
      expect(snippet).toContain(draft.name);
    });

    it("includes hook-based middleware", () => {
      const snippet = generateFastifySnippet(draft);
      expect(snippet).toContain("addHook");
      expect(snippet).toContain("preHandler");
    });
  });

  describe("Next.js snippet", () => {
    it("generates valid Next.js code", () => {
      const snippet = generateNextJsSnippet(draft);

      expect(snippet).toContain("import { NextRequest, NextResponse }");
      expect(snippet).toContain("@lumenbazaar/seller-sdk");
      expect(snippet).toContain("export async function GET");
      expect(snippet).toContain(draft.name);
    });

    it("includes error handling", () => {
      const snippet = generateNextJsSnippet(draft);
      expect(snippet).toContain("402");
      expect(snippet).toContain("PAYMENT_REQUIRED");
    });

    it("includes runtime configuration", () => {
      const snippet = generateNextJsSnippet(draft);
      expect(snippet).toContain("export const config");
      expect(snippet).toContain("runtime");
    });
  });

  describe("framework selector", () => {
    it("generates Express snippet for express framework", () => {
      const snippet = generateSnippet("express", draft);
      expect(snippet).toContain("import express");
    });

    it("generates Fastify snippet for fastify framework", () => {
      const snippet = generateSnippet("fastify", draft);
      expect(snippet).toContain("import Fastify");
    });

    it("generates Next.js snippet for nextjs framework", () => {
      const snippet = generateSnippet("nextjs", draft);
      expect(snippet).toContain("NextRequest");
    });
  });

  describe("snippet content", () => {
    it("includes resource metadata in all snippets", () => {
      ["express", "fastify", "nextjs"].forEach((fw) => {
        const snippet = generateSnippet(fw as MiddlewareFramework, draft);
        expect(snippet).toContain("resourceMetadata");
      });
    });

    it("includes environment variable references", () => {
      ["express", "fastify", "nextjs"].forEach((fw) => {
        const snippet = generateSnippet(fw as MiddlewareFramework, draft);
        expect(snippet).toMatch(/LUMENBAZAAR_API_URL|NEXT_PUBLIC_LUMENBAZAAR_API_URL/);
      });
    });
  });

  describe("special characters in templates", () => {
    it("handles route parameters correctly", () => {
      const testDraft = updateDraft(draft, {
        routeTemplate: "/api/v1/resource/{id}/details"
      });

      const expressSnippet = generateExpressSnippet(testDraft);
      expect(expressSnippet).toContain("/api/v1/resource/:param/details");
    });
  });
});
