import { describe, it, expect, beforeEach } from "vitest";

import { parseDiscoveryState } from "./discovery-params";
import {
  SAVED_DISCOVERY_SEARCHES_STORAGE_KEY,
  loadSavedDiscoverySearches,
  saveDiscoverySearch
} from "./discovery-saved-searches";
import {
  clearFrontendLocalData,
  defaultFrontendSettings,
  frontendLocalDataStorageKeys,
  frontendSettingsSchema,
  loadDiscoveryDensity,
  loadFrontendSettings,
  resetDiscoveryDensity,
  resetFrontendSettings,
  saveDiscoveryDensity,
  saveFrontendSettings,
  type FrontendSettings
} from "./settings";

// Mock storage for testing
class MockStorage implements Storage {
  private data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe("Frontend Settings", () => {
  let mockStorage: MockStorage;

  beforeEach(() => {
    mockStorage = new MockStorage();
  });

  describe("defaultFrontendSettings", () => {
    it("returns default settings with all required fields", () => {
      const defaults = defaultFrontendSettings();

      expect(defaults).toHaveProperty("facilitatorUrl");
      expect(defaults).toHaveProperty("network");
      expect(defaults).toHaveProperty("walletPreference");
      expect(defaults).toHaveProperty("timezoneId");
      expect(defaults).toHaveProperty("localeCode");
    });

    it("sets facilitatorUrl from config", () => {
      const defaults = defaultFrontendSettings();
      expect(typeof defaults.facilitatorUrl).toBe("string");
      expect(defaults.facilitatorUrl.length).toBeGreaterThan(0);
    });

    it("sets network from config", () => {
      const defaults = defaultFrontendSettings();
      expect(["stellar:testnet", "stellar:pubnet"]).toContain(defaults.network);
    });

    it("sets wallet preference to freighter", () => {
      const defaults = defaultFrontendSettings();
      expect(defaults.walletPreference).toBe("freighter");
    });

    it("includes valid timezone ID", () => {
      const defaults = defaultFrontendSettings();
      expect(typeof defaults.timezoneId).toBe("string");
      expect(defaults.timezoneId.length).toBeGreaterThan(0);
    });

    it("includes valid locale code", () => {
      const defaults = defaultFrontendSettings();
      expect(typeof defaults.localeCode).toBe("string");
      expect(defaults.localeCode).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
    });
  });

  describe("frontendSettingsSchema", () => {
    it("validates valid settings", () => {
      const validSettings: FrontendSettings = {
        facilitatorUrl: "http://localhost:8080",
        network: "stellar:testnet",
        walletPreference: "freighter",
        timezoneId: "America/New_York",
        localeCode: "en-US"
      };

      const result = frontendSettingsSchema.safeParse(validSettings);
      expect(result.success).toBe(true);
    });

    it("validates with different valid timezones", () => {
      const timezones = ["UTC", "Europe/London", "Asia/Tokyo", "America/Los_Angeles"];

      timezones.forEach((tz) => {
        const settings: FrontendSettings = {
          facilitatorUrl: "http://localhost:8080",
          network: "stellar:testnet",
          walletPreference: "manual",
          timezoneId: tz,
          localeCode: "en-US"
        };

        const result = frontendSettingsSchema.safeParse(settings);
        expect(result.success).toBe(true);
      });
    });

    it("validates with different valid locales", () => {
      const locales = ["en-US", "de-DE", "fr-FR", "ja-JP"];

      locales.forEach((locale) => {
        const settings: FrontendSettings = {
          facilitatorUrl: "http://localhost:8080",
          network: "stellar:testnet",
          walletPreference: "none",
          timezoneId: "UTC",
          localeCode: locale
        };

        const result = frontendSettingsSchema.safeParse(settings);
        expect(result.success).toBe(true);
      });
    });

    it("rejects invalid timezone ID", () => {
      const invalidSettings = {
        facilitatorUrl: "http://localhost:8080",
        network: "stellar:testnet",
        walletPreference: "freighter",
        timezoneId: "Invalid/Timezone",
        localeCode: "en-US"
      };

      const result = frontendSettingsSchema.safeParse(invalidSettings);
      expect(result.success).toBe(false);
    });

    it("rejects invalid locale code", () => {
      const invalidSettings = {
        facilitatorUrl: "http://localhost:8080",
        network: "stellar:testnet",
        walletPreference: "freighter",
        timezoneId: "UTC",
        localeCode: "invalid-locale"
      };

      const result = frontendSettingsSchema.safeParse(invalidSettings);
      expect(result.success).toBe(false);
    });

    it("rejects invalid facilitator URL", () => {
      const invalidSettings = {
        facilitatorUrl: "not-a-url",
        network: "stellar:testnet",
        walletPreference: "freighter",
        timezoneId: "UTC",
        localeCode: "en-US"
      };

      const result = frontendSettingsSchema.safeParse(invalidSettings);
      expect(result.success).toBe(false);
    });

    it("rejects invalid network", () => {
      const invalidSettings = {
        facilitatorUrl: "http://localhost:8080",
        network: "invalid:network",
        walletPreference: "freighter",
        timezoneId: "UTC",
        localeCode: "en-US"
      };

      const result = frontendSettingsSchema.safeParse(invalidSettings);
      expect(result.success).toBe(false);
    });

    it("rejects invalid wallet preference", () => {
      const invalidSettings = {
        facilitatorUrl: "http://localhost:8080",
        network: "stellar:testnet",
        walletPreference: "invalid-wallet",
        timezoneId: "UTC",
        localeCode: "en-US"
      };

      const result = frontendSettingsSchema.safeParse(invalidSettings);
      expect(result.success).toBe(false);
    });
  });

  describe("saveFrontendSettings", () => {
    it("saves settings to storage", () => {
      const settings: FrontendSettings = {
        facilitatorUrl: "http://localhost:8080",
        network: "stellar:testnet",
        walletPreference: "freighter",
        timezoneId: "America/New_York",
        localeCode: "en-US"
      };

      saveFrontendSettings(settings, mockStorage);

      const stored = mockStorage.getItem("lumenbazaar.frontend.settings.v1");
      expect(stored).not.toBeNull();
    });

    it("serializes settings to JSON", () => {
      const settings: FrontendSettings = {
        facilitatorUrl: "http://localhost:8080",
        network: "stellar:testnet",
        walletPreference: "freighter",
        timezoneId: "America/New_York",
        localeCode: "en-US"
      };

      saveFrontendSettings(settings, mockStorage);

      const stored = mockStorage.getItem("lumenbazaar.frontend.settings.v1");
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed.facilitatorUrl).toBe("http://localhost:8080");
      expect(parsed.network).toBe("stellar:testnet");
      expect(parsed.walletPreference).toBe("freighter");
      expect(parsed.timezoneId).toBe("America/New_York");
      expect(parsed.localeCode).toBe("en-US");
    });

    it("strips trailing slashes from facilitator URL", () => {
      const settings: FrontendSettings = {
        facilitatorUrl: "http://localhost:8080/",
        network: "stellar:testnet",
        walletPreference: "freighter",
        timezoneId: "UTC",
        localeCode: "en-US"
      };

      const result = saveFrontendSettings(settings, mockStorage);

      expect(result.facilitatorUrl).toBe("http://localhost:8080");
    });

    it("validates settings before saving", () => {
      const invalidSettings = {
        facilitatorUrl: "not-a-url",
        network: "stellar:testnet",
        walletPreference: "freighter",
        timezoneId: "UTC",
        localeCode: "en-US"
      };

      expect(() => {
        saveFrontendSettings(invalidSettings as FrontendSettings, mockStorage);
      }).toThrow();
    });

    it("returns parsed settings after saving", () => {
      const settings: FrontendSettings = {
        facilitatorUrl: "http://localhost:8080",
        network: "stellar:testnet",
        walletPreference: "freighter",
        timezoneId: "UTC",
        localeCode: "en-US"
      };

      const result = saveFrontendSettings(settings, mockStorage);

      expect(result).toEqual({
        facilitatorUrl: "http://localhost:8080",
        network: "stellar:testnet",
        walletPreference: "freighter",
        timezoneId: "UTC",
        localeCode: "en-US"
      });
    });
  });

  describe("loadFrontendSettings", () => {
    it("returns defaults when storage is empty", () => {
      const result = loadFrontendSettings(mockStorage);

      expect(result).toHaveProperty("facilitatorUrl");
      expect(result).toHaveProperty("network");
      expect(result).toHaveProperty("walletPreference");
      expect(result).toHaveProperty("timezoneId");
      expect(result).toHaveProperty("localeCode");
    });

    it("loads settings from storage when available", () => {
      const originalSettings: FrontendSettings = {
        facilitatorUrl: "http://example.com:9000",
        network: "stellar:testnet",
        walletPreference: "manual",
        timezoneId: "Europe/Paris",
        localeCode: "fr-FR"
      };

      saveFrontendSettings(originalSettings, mockStorage);
      const loaded = loadFrontendSettings(mockStorage);

      expect(loaded.facilitatorUrl).toBe("http://example.com:9000");
      expect(loaded.network).toBe("stellar:testnet");
      expect(loaded.walletPreference).toBe("manual");
      expect(loaded.timezoneId).toBe("Europe/Paris");
      expect(loaded.localeCode).toBe("fr-FR");
    });

    it("merges loaded settings with defaults", () => {
      const partialSettings = {
        timezoneId: "Asia/Tokyo",
        localeCode: "ja-JP"
      };

      mockStorage.setItem("lumenbazaar.frontend.settings.v1", JSON.stringify(partialSettings));

      const loaded = loadFrontendSettings(mockStorage);

      // Should have defaults merged with loaded settings
      expect(loaded.timezoneId).toBe("Asia/Tokyo");
      expect(loaded.localeCode).toBe("ja-JP");
      expect(loaded.facilitatorUrl).toBeTruthy();
      expect(loaded.network).toBeTruthy();
      expect(loaded.walletPreference).toBeTruthy();
    });

    it("returns defaults for invalid stored settings", () => {
      mockStorage.setItem("lumenbazaar.frontend.settings.v1", '{"invalid": "settings"}');

      const loaded = loadFrontendSettings(mockStorage);
      const defaults = defaultFrontendSettings();

      expect(loaded).toEqual(defaults);
    });

    it("returns defaults for malformed JSON", () => {
      mockStorage.setItem("lumenbazaar.frontend.settings.v1", "not valid json");

      const loaded = loadFrontendSettings(mockStorage);
      const defaults = defaultFrontendSettings();

      expect(loaded).toEqual(defaults);
    });

    it("handles undefined storage gracefully", () => {
      const result = loadFrontendSettings(undefined);
      const defaults = defaultFrontendSettings();

      expect(result).toEqual(defaults);
    });
  });

  describe("resetFrontendSettings", () => {
    it("removes settings from storage", () => {
      const settings: FrontendSettings = {
        facilitatorUrl: "http://localhost:8080",
        network: "stellar:testnet",
        walletPreference: "freighter",
        timezoneId: "UTC",
        localeCode: "en-US"
      };

      saveFrontendSettings(settings, mockStorage);
      expect(mockStorage.getItem("lumenbazaar.frontend.settings.v1")).not.toBeNull();

      resetFrontendSettings(mockStorage);

      expect(mockStorage.getItem("lumenbazaar.frontend.settings.v1")).toBeNull();
    });

    it("returns default settings after reset", () => {
      const settings: FrontendSettings = {
        facilitatorUrl: "http://example.com",
        network: "stellar:testnet",
        walletPreference: "manual",
        timezoneId: "Europe/London",
        localeCode: "en-GB"
      };

      saveFrontendSettings(settings, mockStorage);
      const reset = resetFrontendSettings(mockStorage);

      expect(reset).toEqual(defaultFrontendSettings());
    });
  });

  describe("Settings persistence workflow", () => {
    it("supports full settings update workflow", () => {
      // Start with defaults
      const settings = loadFrontendSettings(mockStorage);
      expect(settings.timezoneId).toBe(defaultFrontendSettings().timezoneId);

      // Update settings
      const updated: FrontendSettings = {
        ...settings,
        timezoneId: "America/Chicago",
        localeCode: "es-MX"
      };

      saveFrontendSettings(updated, mockStorage);

      // Load and verify
      const loaded = loadFrontendSettings(mockStorage);
      expect(loaded.timezoneId).toBe("America/Chicago");
      expect(loaded.localeCode).toBe("es-MX");

      // Reset
      const reset = resetFrontendSettings(mockStorage);
      expect(reset.timezoneId).toBe(defaultFrontendSettings().timezoneId);

      // Verify storage is cleared
      const cleared = loadFrontendSettings(mockStorage);
      expect(cleared).toEqual(defaultFrontendSettings());
    });

    it("prevents invalid timezone from being saved", () => {
      const invalidSettings = {
        ...defaultFrontendSettings(),
        timezoneId: "Invalid/Timezone"
      };

      expect(() => {
        saveFrontendSettings(invalidSettings as FrontendSettings, mockStorage);
      }).toThrow();

      // Original settings should still be in storage (or none if first save)
      const loaded = loadFrontendSettings(mockStorage);
      expect(loaded.timezoneId).toBe(defaultFrontendSettings().timezoneId);
    });

    it("prevents invalid locale from being saved", () => {
      const invalidSettings = {
        ...defaultFrontendSettings(),
        localeCode: "xx-XX"
      };

      expect(() => {
        saveFrontendSettings(invalidSettings as FrontendSettings, mockStorage);
      }).toThrow();

      const loaded = loadFrontendSettings(mockStorage);
      expect(loaded.localeCode).toBe(defaultFrontendSettings().localeCode);
    });
  });

  describe("Discovery density", () => {
    it("defaults to comfortable", () => {
      expect(loadDiscoveryDensity(mockStorage)).toBe("comfortable");
    });

    it("persists only supported densities", () => {
      saveDiscoveryDensity("compact", mockStorage);

      expect(loadDiscoveryDensity(mockStorage)).toBe("compact");
    });

    it("falls back for unsupported or invalid stored values", () => {
      mockStorage.setItem("lumenbazaar.frontend.discovery-density.v1", "dense");
      expect(loadDiscoveryDensity(mockStorage)).toBe("comfortable");
    });

    it("resets to the default", () => {
      saveDiscoveryDensity("compact", mockStorage);

      expect(resetDiscoveryDensity(mockStorage)).toBe("comfortable");
      expect(loadDiscoveryDensity(mockStorage)).toBe("comfortable");
    });
  });

  describe("Clear local data", () => {
    it("removes every saved discovery search", () => {
      saveDiscoverySearch("Weather", parseDiscoveryState({ q: "weather" }), mockStorage);
      saveDiscoverySearch("Maps", parseDiscoveryState({ q: "maps" }), mockStorage);

      clearFrontendLocalData(mockStorage);

      expect(mockStorage.getItem(SAVED_DISCOVERY_SEARCHES_STORAGE_KEY)).toBeNull();
      expect(loadSavedDiscoverySearches(mockStorage)).toEqual([]);
    });

    it("resets frontend preferences and the discovery density", () => {
      saveFrontendSettings(
        { ...defaultFrontendSettings(), walletPreference: "manual" },
        mockStorage
      );
      saveDiscoveryDensity("compact", mockStorage);

      expect(clearFrontendLocalData(mockStorage)).toEqual(defaultFrontendSettings());
      expect(loadFrontendSettings(mockStorage)).toEqual(defaultFrontendSettings());
      expect(loadDiscoveryDensity(mockStorage)).toBe("comfortable");
    });

    it("leaves unrelated local data untouched", () => {
      const unrelated = {
        "lumenbazaar.accessibility.theme.v1": "high-contrast",
        "lumenbazaar.frontend.bookmarks.v1": "[]",
        "lumenbazaar.frontend.column-preferences.v1": "{}",
        "lumenbazaar.frontend.recently-viewed.v1": "[]",
        "lumenbazaar.frontend.transaction-views.v1": "[]",
        "lumenbazaar.wallet.provider.v1": "freighter",
        lumenbazaar_resource_draft: "{}"
      };
      for (const [key, value] of Object.entries(unrelated)) {
        mockStorage.setItem(key, value);
      }
      saveDiscoverySearch("Weather", parseDiscoveryState({ q: "weather" }), mockStorage);

      clearFrontendLocalData(mockStorage);

      for (const [key, value] of Object.entries(unrelated)) {
        expect(mockStorage.getItem(key)).toBe(value);
      }
      expect(mockStorage.length).toBe(Object.keys(unrelated).length);
    });

    it("documents exactly which keys it clears", () => {
      expect(frontendLocalDataStorageKeys).toEqual([
        "lumenbazaar.frontend.settings.v1",
        "lumenbazaar.frontend.discovery-density.v1",
        "lumenbazaar.frontend.discovery-searches.v1"
      ]);
    });
  });
});
