import { describe, it, expect, beforeEach, afterEach } from "vitest";

import {
  validateRouteTemplate,
  routeTemplateError,
  createEmptyDraft,
  updateDraft,
  saveDraftToStorage,
  loadDraftFromStorage,
  clearDraftFromStorage
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
        expect(validateRouteTemplate("mcp://lumen-rag-demo/search_stellar_docs", "mcp")).toBe(
          true
        );
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
