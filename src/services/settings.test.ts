import { describe, expect, it } from "vitest";

import {
  frontendSettingsStorageKey,
  loadFrontendSettings,
  resetFrontendSettings,
  saveFrontendSettings
} from "./settings";

describe("frontend settings", () => {
  it("loads defaults when local storage is empty", () => {
    const storage = memoryStorage();

    expect(loadFrontendSettings(storage)).toMatchObject({
      network: "stellar:testnet",
      walletPreference: "freighter"
    });
  });

  it("persists sanitized developer overrides", () => {
    const storage = memoryStorage();
    const saved = saveFrontendSettings(
      {
        facilitatorUrl: "http://localhost:8080/",
        network: "stellar:testnet",
        walletPreference: "manual"
      },
      storage
    );

    expect(saved.facilitatorUrl).toBe("http://localhost:8080");
    expect(loadFrontendSettings(storage).walletPreference).toBe("manual");
  });

  it("resets stored settings back to runtime defaults", () => {
    const storage = memoryStorage();
    storage.setItem(frontendSettingsStorageKey, JSON.stringify({ network: "stellar:pubnet" }));

    expect(resetFrontendSettings(storage).network).toBe("stellar:testnet");
    expect(storage.getItem(frontendSettingsStorageKey)).toBeNull();
  });
});

function memoryStorage() {
  const values = new Map<string, string>();

  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    }
  };
}
