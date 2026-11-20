import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseDiscoveryState, type DiscoveryState } from "./discovery-params";
import {
  MAX_SAVED_DISCOVERY_SEARCHES,
  MAX_SAVED_DISCOVERY_SEARCH_NAME_LENGTH,
  SAVED_DISCOVERY_SEARCHES_STORAGE_KEY,
  clearSavedDiscoverySearches,
  deleteDiscoverySearch,
  getSavedDiscoverySearchesSnapshot,
  loadSavedDiscoverySearches,
  parseSavedSearchName,
  renameDiscoverySearch,
  saveDiscoverySearch,
  subscribeSavedDiscoverySearches,
  toSavedDiscoveryState
} from "./discovery-saved-searches";

class MemoryStorage {
  readonly data = new Map<string, string>();
  readonly setItem = vi.fn((key: string, value: string) => {
    this.data.set(key, value);
  });
  readonly removeItem = vi.fn((key: string) => {
    this.data.delete(key);
  });

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
}

const weatherState: DiscoveryState = {
  asset: "USDC",
  cursor: "cursor_page_2",
  extension: "bazaar",
  maxPrice: "0.20",
  minPrice: "0.05",
  network: "stellar:testnet",
  q: "weather lagos",
  sellerVerification: "verified",
  sort: "price-asc",
  type: "http"
};

const validRecord = {
  createdAt: "2026-11-20T12:00:00.000Z",
  id: "search_1",
  name: "Weather",
  state: { q: "weather", sellerVerification: "any", sort: "relevance" }
};

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
});

afterEach(() => {
  window.localStorage.clear();
});

function storeRaw(value: unknown) {
  storage.data.set(
    SAVED_DISCOVERY_SEARCHES_STORAGE_KEY,
    typeof value === "string" ? value : JSON.stringify(value)
  );
}

function fill(count: number) {
  for (let index = 0; index < count; index += 1) {
    saveDiscoverySearch(`Search ${index + 1}`, parseDiscoveryState({ q: `q${index}` }), storage);
  }
}

describe("saved discovery searches", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(loadSavedDiscoverySearches(storage)).toEqual([]);
  });

  it("saves a named search that round-trips through JSON", () => {
    const saved = saveDiscoverySearch("Weather APIs", weatherState, storage);
    const loaded = loadSavedDiscoverySearches(storage);

    expect(loaded).toEqual([saved]);
    expect(JSON.parse(storage.data.get(SAVED_DISCOVERY_SEARCHES_STORAGE_KEY)!)).toEqual([saved]);
    expect(saved.name).toBe("Weather APIs");
    expect(saved.id).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Number.isNaN(Date.parse(saved.createdAt))).toBe(false);
  });

  it("never stores the pagination cursor", () => {
    const saved = saveDiscoverySearch("Weather", weatherState, storage);
    const raw = storage.data.get(SAVED_DISCOVERY_SEARCHES_STORAGE_KEY)!;

    expect(saved.state).not.toHaveProperty("cursor");
    expect(raw).not.toContain("cursor");
    expect(saved.state).toEqual({
      asset: "USDC",
      extension: "bazaar",
      maxPrice: "0.20",
      minPrice: "0.05",
      network: "stellar:testnet",
      q: "weather lagos",
      sellerVerification: "verified",
      sort: "price-asc",
      type: "http"
    });
  });

  it("persists only the name, id, timestamp, and discovery fields", () => {
    const withExtras = {
      ...weatherState,
      paymentAuthorization: "signed-payload",
      sellerSession: "session",
      walletAddress: "GSYNTHETIC"
    } as DiscoveryState;

    saveDiscoverySearch("Weather", withExtras, storage);

    const [record] = JSON.parse(storage.data.get(SAVED_DISCOVERY_SEARCHES_STORAGE_KEY)!);
    expect(Object.keys(record).sort()).toEqual(["createdAt", "id", "name", "state"]);
    expect(Object.keys(record.state).sort()).toEqual([
      "asset",
      "extension",
      "maxPrice",
      "minPrice",
      "network",
      "q",
      "sellerVerification",
      "sort",
      "type"
    ]);
  });

  it("normalizes query, network, enum, asset, and price values with discovery rules", () => {
    const saved = saveDiscoverySearch(
      "Messy draft",
      {
        asset: "  USDC  ",
        extension: "nope" as never,
        maxPrice: "0.01",
        minPrice: "0.50",
        network: "stellar:futurenet" as never,
        q: "  weather  ",
        sellerVerification: "maybe" as never,
        sort: "cheapest" as never,
        type: "graphql" as never
      },
      storage
    );

    expect(saved.state).toEqual({
      asset: "USDC",
      minPrice: "0.50",
      q: "weather",
      sellerVerification: "any",
      sort: "relevance"
    });
  });

  it("drops malformed asset and price drafts instead of saving them", () => {
    expect(
      toSavedDiscoveryState({
        asset: "bad asset!",
        maxPrice: "1e9",
        minPrice: "abc",
        q: "",
        sellerVerification: "any",
        sort: "relevance"
      })
    ).toEqual({ q: "", sellerVerification: "any", sort: "relevance" });
  });

  it("stores searches newest first", () => {
    saveDiscoverySearch("First", parseDiscoveryState({ q: "one" }), storage);
    saveDiscoverySearch("Second", parseDiscoveryState({ q: "two" }), storage);

    expect(loadSavedDiscoverySearches(storage).map((search) => search.name)).toEqual([
      "Second",
      "First"
    ]);
  });

  describe("names", () => {
    it("rejects empty and whitespace-only names without writing", () => {
      expect(() => saveDiscoverySearch("", weatherState, storage)).toThrow(
        "Enter a name for this search."
      );
      expect(() => saveDiscoverySearch("   ", weatherState, storage)).toThrow(
        "Enter a name for this search."
      );
      expect(storage.setItem).not.toHaveBeenCalled();
    });

    it("trims names", () => {
      expect(saveDiscoverySearch("  Weather  ", weatherState, storage).name).toBe("Weather");
      expect(parseSavedSearchName("\tTabs\n")).toBe("Tabs");
    });

    it("accepts the maximum length and rejects longer names", () => {
      const longest = "a".repeat(MAX_SAVED_DISCOVERY_SEARCH_NAME_LENGTH);

      expect(saveDiscoverySearch(longest, weatherState, storage).name).toBe(longest);
      expect(() => saveDiscoverySearch(`${longest}b`, weatherState, storage)).toThrow(
        "Search names are limited to 60 characters."
      );
      expect(loadSavedDiscoverySearches(storage)).toHaveLength(1);
    });
  });

  it("refuses to save beyond the limit instead of evicting an older search", () => {
    fill(MAX_SAVED_DISCOVERY_SEARCHES);
    const before = storage.data.get(SAVED_DISCOVERY_SEARCHES_STORAGE_KEY);

    expect(() => saveDiscoverySearch("One too many", weatherState, storage)).toThrow(
      "You can keep up to 20 saved searches. Delete one to save another."
    );
    expect(storage.data.get(SAVED_DISCOVERY_SEARCHES_STORAGE_KEY)).toBe(before);
    expect(loadSavedDiscoverySearches(storage)).toHaveLength(MAX_SAVED_DISCOVERY_SEARCHES);
  });

  it("renames only the selected search and keeps its id and state", () => {
    const first = saveDiscoverySearch("First", parseDiscoveryState({ q: "one" }), storage);
    const second = saveDiscoverySearch("Second", weatherState, storage);

    const next = renameDiscoverySearch(second.id, "  Weather in Lagos ", storage);

    expect(next).toEqual([{ ...second, name: "Weather in Lagos" }, first]);
    expect(loadSavedDiscoverySearches(storage)).toEqual(next);
  });

  it("validates rename names with the same rules as save", () => {
    const saved = saveDiscoverySearch("Weather", weatherState, storage);
    storage.setItem.mockClear();

    expect(() => renameDiscoverySearch(saved.id, "  ", storage)).toThrow(
      "Enter a name for this search."
    );
    expect(() => renameDiscoverySearch(saved.id, "x".repeat(61), storage)).toThrow(
      "Search names are limited to 60 characters."
    );
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("deletes only the selected search", () => {
    const first = saveDiscoverySearch("First", parseDiscoveryState({ q: "one" }), storage);
    const second = saveDiscoverySearch("Second", weatherState, storage);

    expect(deleteDiscoverySearch(second.id, storage)).toEqual([first]);
    expect(loadSavedDiscoverySearches(storage)).toEqual([first]);
  });

  it("handles unknown ids safely", () => {
    const saved = saveDiscoverySearch("Weather", weatherState, storage);
    storage.setItem.mockClear();

    expect(deleteDiscoverySearch("missing", storage)).toEqual([saved]);
    expect(() => renameDiscoverySearch("missing", "Renamed", storage)).toThrow(
      "That saved search no longer exists on this device."
    );
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(loadSavedDiscoverySearches(storage)).toEqual([saved]);
  });

  it("returns an empty list for invalid JSON without throwing", () => {
    storeRaw("{not json");

    expect(() => loadSavedDiscoverySearches(storage)).not.toThrow();
    expect(loadSavedDiscoverySearches(storage)).toEqual([]);
  });

  it("accepts a well-formed stored payload", () => {
    storeRaw([validRecord]);

    expect(loadSavedDiscoverySearches(storage)).toEqual([validRecord]);
  });

  it.each([
    ["a non-array payload", { searches: [validRecord] }],
    ["null", null],
    ["a record with the wrong types", [{ ...validRecord, name: 42 }]],
    ["a record with an extra field", [{ ...validRecord, walletAddress: "GSYNTHETIC" }]],
    ["a state with an extra field", [{ ...validRecord, state: { ...validRecord.state, x: 1 } }]],
    ["a stored cursor", [{ ...validRecord, state: { ...validRecord.state, cursor: "page_2" } }]],
    ["an invalid sort", [{ ...validRecord, state: { ...validRecord.state, sort: "cheapest" } }]],
    [
      "an unknown network",
      [{ ...validRecord, state: { ...validRecord.state, network: "stellar:futurenet" } }]
    ],
    ["a malformed price", [{ ...validRecord, state: { ...validRecord.state, minPrice: "abc" } }]],
    [
      "contradictory prices",
      [{ ...validRecord, state: { ...validRecord.state, maxPrice: "0.01", minPrice: "0.5" } }]
    ],
    [
      "an oversized query",
      [{ ...validRecord, state: { ...validRecord.state, q: "q".repeat(201) } }]
    ],
    ["an untrimmed query", [{ ...validRecord, state: { ...validRecord.state, q: " weather" } }]],
    ["an oversized name", [{ ...validRecord, name: "n".repeat(61) }]],
    ["an empty name", [{ ...validRecord, name: "   " }]],
    ["an invalid id", [{ ...validRecord, id: "<script>" }]],
    ["an invalid timestamp", [{ ...validRecord, createdAt: "yesterday" }]],
    ["a missing state", [{ ...validRecord, state: undefined }]],
    ["duplicate ids", [validRecord, { ...validRecord, name: "Copy" }]],
    [
      "more than 20 records",
      Array.from({ length: 21 }, (_, index) => ({ ...validRecord, id: `search_${index}` }))
    ]
  ])("rejects %s so it never reaches the query layer", (_label, payload) => {
    storeRaw(payload);

    expect(loadSavedDiscoverySearches(storage)).toEqual([]);
  });

  it("clears only the saved-search key", () => {
    storage.data.set("lumenbazaar.frontend.settings.v1", "{}");
    storage.data.set("lumenbazaar.frontend.bookmarks.v1", "[]");
    saveDiscoverySearch("Weather", weatherState, storage);

    clearSavedDiscoverySearches(storage);

    expect(storage.removeItem).toHaveBeenCalledTimes(1);
    expect(storage.removeItem).toHaveBeenCalledWith(SAVED_DISCOVERY_SEARCHES_STORAGE_KEY);
    expect(storage.data.has(SAVED_DISCOVERY_SEARCHES_STORAGE_KEY)).toBe(false);
    expect(storage.data.get("lumenbazaar.frontend.settings.v1")).toBe("{}");
    expect(storage.data.get("lumenbazaar.frontend.bookmarks.v1")).toBe("[]");
  });

  it("treats storage that throws on read as empty", () => {
    const throwing = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      removeItem: vi.fn(),
      setItem: vi.fn()
    };

    expect(loadSavedDiscoverySearches(throwing)).toEqual([]);
  });

  describe("browser snapshot", () => {
    it("notifies subscribers and keeps a stable snapshot between writes", () => {
      const listener = vi.fn();
      const unsubscribe = subscribeSavedDiscoverySearches(listener);

      const empty = getSavedDiscoverySearchesSnapshot();
      expect(empty).toEqual([]);
      expect(getSavedDiscoverySearchesSnapshot()).toBe(empty);

      const saved = saveDiscoverySearch("Weather", weatherState);
      expect(listener).toHaveBeenCalledTimes(1);

      const afterSave = getSavedDiscoverySearchesSnapshot();
      expect(afterSave).toEqual([saved]);
      expect(getSavedDiscoverySearchesSnapshot()).toBe(afterSave);

      clearSavedDiscoverySearches();
      expect(listener).toHaveBeenCalledTimes(2);
      expect(getSavedDiscoverySearchesSnapshot()).toEqual([]);

      unsubscribe();
      saveDiscoverySearch("Ignored", weatherState);
      expect(listener).toHaveBeenCalledTimes(2);
    });

    it("updates when another tab changes the saved-search key", () => {
      const listener = vi.fn();
      const unsubscribe = subscribeSavedDiscoverySearches(listener);

      window.dispatchEvent(new StorageEvent("storage", { key: "unrelated" }));
      expect(listener).not.toHaveBeenCalled();

      window.dispatchEvent(
        new StorageEvent("storage", { key: SAVED_DISCOVERY_SEARCHES_STORAGE_KEY })
      );
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
    });
  });
});
