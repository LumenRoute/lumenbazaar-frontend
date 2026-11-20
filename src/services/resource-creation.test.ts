import { describe, it, expect, beforeEach, afterEach } from "vitest";

import {
  validateRouteTemplate,
  routeTemplateError,
  createEmptyDraft,
  updateDraft,
  saveDraftToStorage,
  loadDraftFromStorage,
  clearDraftFromStorage,
  buildResourcePublishPayload,
  formatDraftAge,
  loadDraftRecoveryFromStorage,
  RESOURCE_DRAFT_STORAGE_VERSION,
  RESOURCE_PUBLISH_OMITTED_FIELDS,
  exportResourceDraftToJson,
  importResourceDraftFromJson,
  MAX_RESOURCE_DRAFT_IMPORT_BYTES,
  ResourceDraftImportError,
  type ResourceDraft
} from "./resource-creation";

describe("resource creation service", () => {
  describe("route template validation", () => {
    describe("HTTP routes", () => {
      it("accepts simple HTTP routes", () => {
        expect(validateRouteTemplate("/weather", "http")).toBe(true);
        expect(validateRouteTemplate("/weather/current", "http")).toBe(true);
        expect(validateRouteTemplate("/weather/{city}", "http")).toBe(true);
        expect(validateRouteTemplate("/weather/{city}/forecast", "http")).toBe(true);
      });

      it("rejects HTTP routes without leading slash", () => {
        expect(validateRouteTemplate("weather", "http")).toBe(false);
        expect(routeTemplateError("weather", "http")).toContain("start with /");
      });

      it("rejects HTTP routes with invalid characters", () => {
        expect(validateRouteTemplate("/weather!bad", "http")).toBe(false);
        expect(validateRouteTemplate("/weather @test", "http")).toBe(false);
      });

      it("accepts HTTP routes with hyphens and underscores", () => {
        expect(validateRouteTemplate("/weather-api/current_temp", "http")).toBe(true);
      });
    });

    describe("MCP routes", () => {
      it("accepts valid MCP routes", () => {
        expect(validateRouteTemplate("mcp://server/tool", "mcp")).toBe(true);
        expect(validateRouteTemplate("mcp://lumen-rag-demo/search_stellar_docs", "mcp")).toBe(true);
        expect(validateRouteTemplate("mcp://my.server/my_tool", "mcp")).toBe(true);
      });

      it("rejects MCP routes without mcp:// prefix", () => {
        expect(validateRouteTemplate("server/tool", "mcp")).toBe(false);
        expect(routeTemplateError("server/tool", "mcp")).toContain("mcp://");
      });

      it("rejects MCP routes with invalid format", () => {
        expect(validateRouteTemplate("mcp://server", "mcp")).toBe(false);
        expect(validateRouteTemplate("mcp://server/", "mcp")).toBe(false);
        expect(validateRouteTemplate("mcp://server/tool/extra", "mcp")).toBe(false);
      });
    });
  });

  describe("route template error messages", () => {
    it("returns error for empty template", () => {
      expect(routeTemplateError("", "http")).toBe("Route template is required");
      expect(routeTemplateError("", "mcp")).toBe("Route template is required");
    });

    it("returns specific HTTP error messages", () => {
      const error = routeTemplateError("weather", "http");
      expect(error).toContain("HTTP");
      expect(error).toContain("start with /");
    });

    it("returns specific MCP error messages", () => {
      const error = routeTemplateError("server/tool", "mcp");
      expect(error).toContain("mcp://");
    });

    it("returns null for valid routes", () => {
      expect(routeTemplateError("/weather", "http")).toBeNull();
      expect(routeTemplateError("mcp://server/tool", "mcp")).toBeNull();
    });
  });

  describe("draft state management", () => {
    it("creates empty draft with timestamps", () => {
      const draft = createEmptyDraft();
      expect(draft.name).toBe("");
      expect(draft.description).toBe("");
      expect(draft.type).toBe("http");
      expect(draft.status).toBe("draft");
      expect(draft.createdAt).toBeDefined();
      expect(draft.updatedAt).toBeDefined();
    });

    it("updates draft with new data", () => {
      const draft = createEmptyDraft();
      const updated = updateDraft(draft, { name: "Test API", description: "Test description" });

      expect(updated.name).toBe("Test API");
      expect(updated.description).toBe("Test description");
      expect(updated.createdAt).toBe(draft.createdAt);
      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(draft.updatedAt).getTime()
      );
    });

    it("preserves other fields when updating", () => {
      const draft = createEmptyDraft();
      draft.name = "Original";
      draft.type = "mcp";

      const updated = updateDraft(draft, { description: "New description" });
      expect(updated.name).toBe("Original");
      expect(updated.type).toBe("mcp");
      expect(updated.description).toBe("New description");
    });
  });

  describe("draft export and import", () => {
    function completeDraft(): ResourceDraft {
      return {
        ...createEmptyDraft(),
        amount: "0.0500000",
        assetCode: "USDC",
        assetIssuer: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
        description: "Weather data for a city",
        extensions: { category: "weather" },
        inputSchema: { type: "object" },
        name: "Weather API",
        network: "stellar:testnet",
        outputSchema: { type: "object" },
        payTo: "GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE",
        routeTemplate: "/weather/{city}",
        url: "https://example.test/weather"
      };
    }

    it("round-trips every supported field", () => {
      const draft = completeDraft();
      const imported = importResourceDraftFromJson(exportResourceDraftToJson(draft));

      expect(imported).toEqual(draft);
    });

    it("exports only allowlisted draft metadata without session or wallet secrets", () => {
      const draft = {
        ...completeDraft(),
        privateKey: "S...",
        sessionToken: "jwt",
        signedXdr: "AAAA"
      } as ResourceDraft;

      const exported = exportResourceDraftToJson(draft);

      expect(exported).not.toContain("privateKey");
      expect(exported).not.toContain("sessionToken");
      expect(exported).not.toContain("signedXdr");
      expect(exported).not.toContain("S...");
      expect(JSON.parse(exported).version).toBe(1);
    });

    it("rejects unknown versions", () => {
      const exported = JSON.parse(exportResourceDraftToJson(completeDraft()));
      exported.version = 99;

      expect(() => importResourceDraftFromJson(JSON.stringify(exported))).toThrowError(
        ResourceDraftImportError
      );

      try {
        importResourceDraftFromJson(JSON.stringify(exported));
      } catch (error) {
        expect((error as ResourceDraftImportError).code).toBe("UNSUPPORTED_VERSION");
      }
    });

    it("rejects oversized files before parsing", () => {
      const oversized = "x".repeat(MAX_RESOURCE_DRAFT_IMPORT_BYTES + 1);

      try {
        importResourceDraftFromJson(oversized);
        expect.fail("expected the import to be rejected");
      } catch (error) {
        expect((error as ResourceDraftImportError).code).toBe("OVERSIZED");
      }
    });

    it("rejects invalid JSON and invalid drafts", () => {
      expect(() => importResourceDraftFromJson("{not json")).toThrow(/not valid JSON/);
      expect(() =>
        importResourceDraftFromJson(JSON.stringify({ draft: { name: 1 }, version: 1 }))
      ).toThrow(/failed validation|Invalid input/i);
    });
  });

  describe("publish payload normalization", () => {
    it("builds one normalized payload and omits local bookkeeping", () => {
      const draft: ResourceDraft = {
        ...createEmptyDraft(),
        amount: "",
        assetCode: "",
        assetIssuer: "",
        description: "  Weather data  ",
        name: "  Weather API  ",
        network: "stellar:testnet",
        payTo: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
        routeTemplate: "/weather/{city}",
        url: "https://example.test/weather",
        extensions: { category: "weather" }
      };

      const payload = buildResourcePublishPayload(draft, "seller_1");

      expect(payload.name).toBe("Weather API");
      expect(payload.description).toBe("Weather data");
      expect(payload.amount).toBe("0");
      expect(payload.assetCode).toBe("USDC");
      for (const omitted of RESOURCE_PUBLISH_OMITTED_FIELDS) {
        expect(payload).not.toHaveProperty(omitted);
      }
    });

    it("rejects an incomplete draft before it can be submitted", () => {
      expect(() => buildResourcePublishPayload(createEmptyDraft(), "seller_1")).toThrow();
    });
  });

  describe("localStorage persistence", () => {
    let mockStorage: Record<string, string> = {};

    beforeEach(() => {
      mockStorage = {};
      // Mock localStorage
      global.localStorage = {
        getItem: (key: string) => mockStorage[key] ?? null,
        setItem: (key: string, value: string) => {
          mockStorage[key] = value;
        },
        removeItem: (key: string) => {
          delete mockStorage[key];
        },
        clear: () => {
          mockStorage = {};
        },
        length: 0,
        key: () => null
      } as Storage;
    });

    afterEach(() => {
      mockStorage = {};
    });

    it("saves and loads draft", () => {
      const draft = createEmptyDraft();
      draft.name = "Test API";
      draft.description = "Test Description";

      saveDraftToStorage(draft);
      const loaded = loadDraftFromStorage();

      expect(loaded).not.toBeNull();
      expect(loaded?.name).toBe("Test API");
      expect(loaded?.description).toBe("Test Description");
    });

    it("stores the schema version and save age for recovery", () => {
      const draft = { ...createEmptyDraft(), name: "Recoverable API" } as ResourceDraft & {
        privateKey?: string;
      };
      draft.privateKey = "S...";

      saveDraftToStorage(draft, new Date("2026-11-19T10:00:00.000Z"));

      const recovery = loadDraftRecoveryFromStorage();
      expect(recovery).not.toBeNull();
      expect(recovery?.schemaVersion).toBe(RESOURCE_DRAFT_STORAGE_VERSION);
      expect(recovery?.savedAt).toBe("2026-11-19T10:00:00.000Z");
      expect(recovery?.draft.name).toBe("Recoverable API");
      expect(recovery?.draft).not.toHaveProperty("privateKey");
      expect(formatDraftAge("2026-11-19T10:00:00.000Z", new Date("2026-11-19T10:05:00.000Z"))).toBe(
        "5 minutes"
      );
    });

    it("discards records with an unknown storage schema version", () => {
      mockStorage["lumenbazaar_resource_draft"] = JSON.stringify({
        draft: createEmptyDraft(),
        savedAt: new Date().toISOString(),
        schemaVersion: 99
      });

      expect(loadDraftRecoveryFromStorage()).toBeNull();
      expect(mockStorage["lumenbazaar_resource_draft"]).toBeUndefined();
    });

    it("clears draft from storage", () => {
      const draft = createEmptyDraft();
      draft.name = "Test API";
      saveDraftToStorage(draft);

      clearDraftFromStorage();
      const loaded = loadDraftFromStorage();

      expect(loaded).toBeNull();
    });

    it("returns null when no draft exists", () => {
      const loaded = loadDraftFromStorage();
      expect(loaded).toBeNull();
    });

    it("handles invalid stored data gracefully", () => {
      mockStorage["lumenbazaar_resource_draft"] = "invalid json";
      const loaded = loadDraftFromStorage();
      expect(loaded).toBeNull();
    });
  });
});
