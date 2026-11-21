// @vitest-environment node
import { describe, expect, it } from "vitest";

import { parseDiscoveryState } from "./discovery-params";
import {
  clearSavedDiscoverySearches,
  deleteDiscoverySearch,
  getSavedDiscoverySearchesSnapshot,
  getServerSavedDiscoverySearchesSnapshot,
  loadSavedDiscoverySearches,
  renameDiscoverySearch,
  saveDiscoverySearch,
  subscribeSavedDiscoverySearches
} from "./discovery-saved-searches";

// Server rendering has no `window`, so every helper must fall back to "no
// storage" instead of touching `localStorage`.
describe("saved discovery searches without browser storage", () => {
  it("imports and runs without a window", () => {
    expect(typeof window).toBe("undefined");
    expect(loadSavedDiscoverySearches()).toEqual([]);
    expect(getSavedDiscoverySearchesSnapshot()).toEqual([]);
    expect(getServerSavedDiscoverySearchesSnapshot()).toEqual([]);
    expect(getServerSavedDiscoverySearchesSnapshot()).toBe(
      getServerSavedDiscoverySearchesSnapshot()
    );
  });

  it("treats writes as safe no-ops", () => {
    const saved = saveDiscoverySearch("Weather", parseDiscoveryState({ q: "weather" }));

    expect(saved.name).toBe("Weather");
    expect(loadSavedDiscoverySearches()).toEqual([]);
    expect(deleteDiscoverySearch(saved.id)).toEqual([]);
    expect(() => renameDiscoverySearch(saved.id, "Renamed")).toThrow(
      "That saved search no longer exists on this device."
    );
    expect(() => clearSavedDiscoverySearches()).not.toThrow();

    const unsubscribe = subscribeSavedDiscoverySearches(() => undefined);
    expect(() => unsubscribe()).not.toThrow();
  });
});
