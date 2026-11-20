import { z } from "zod";

import {
  canonicalDiscoveryState,
  pagelessDiscoveryStateSchema,
  type DiscoveryState
} from "@/services/discovery-params";

/**
 * Named discovery searches that live only in this browser profile.
 *
 * Saved searches are local preference data: they are never sent to the API,
 * telemetry, wallet, seller-session, or payment code. Every value is validated
 * against the same rules as the Explore URL, pagination is never stored, and
 * both the name and the list are bounded.
 */

export const SAVED_DISCOVERY_SEARCHES_STORAGE_KEY = "lumenbazaar.frontend.discovery-searches.v1";
export const MAX_SAVED_DISCOVERY_SEARCHES = 20;
export const MAX_SAVED_DISCOVERY_SEARCH_NAME_LENGTH = 60;

const savedSearchIdPattern = /^[A-Za-z0-9_-]+$/;

const savedSearchNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a name for this search.")
  .max(
    MAX_SAVED_DISCOVERY_SEARCH_NAME_LENGTH,
    `Search names are limited to ${MAX_SAVED_DISCOVERY_SEARCH_NAME_LENGTH} characters.`
  );

const savedDiscoverySearchSchema = z.strictObject({
  createdAt: z.iso.datetime(),
  id: z.string().min(1).max(64).regex(savedSearchIdPattern),
  name: savedSearchNameSchema,
  state: pagelessDiscoveryStateSchema
});

const savedDiscoverySearchesSchema = z
  .array(savedDiscoverySearchSchema)
  .max(MAX_SAVED_DISCOVERY_SEARCHES)
  .refine((searches) => new Set(searches.map((search) => search.id)).size === searches.length, {
    message: "Saved search ids must be unique."
  });

export type SavedDiscoverySearch = z.infer<typeof savedDiscoverySearchSchema>;

type StorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;

/**
 * Validates and trims a saved-search name. Throws an `Error` with a message
 * that is safe to show next to the name input.
 */
export function parseSavedSearchName(name: string): string {
  const result = savedSearchNameSchema.safeParse(name);

  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "Enter a valid search name.");
  }

  return result.data;
}

/**
 * Converts any in-memory discovery state into the persisted shape: normalized
 * with the URL parser's rules and with the pagination cursor removed, so a
 * saved search always starts from the first page.
 */
export function toSavedDiscoveryState(state: DiscoveryState): DiscoveryState {
  const canonical = canonicalDiscoveryState({ ...state, cursor: undefined });

  // Copy only defined fields: the strict schema rejects any `cursor` key, and
  // omitting undefined optionals keeps the stored JSON minimal.
  const pageless = Object.fromEntries(
    Object.entries(canonical).filter(([key, value]) => key !== "cursor" && value !== undefined)
  );

  return pagelessDiscoveryStateSchema.parse(pageless);
}

/**
 * Loads saved searches, newest first.
 *
 * Policy: the whole payload is validated at once. Missing storage, missing
 * data, invalid JSON, or any record that fails the strict schema yields an
 * empty list rather than a partially trusted one, so malformed values can
 * never reach the discovery query.
 */
export function loadSavedDiscoverySearches(
  storage: StorageLike | undefined = browserStorage()
): SavedDiscoverySearch[] {
  if (storage === undefined) {
    return [];
  }

  return parseSavedSearchesPayload(readRaw(storage));
}

/**
 * Saves the given discovery state under a name and returns the new record.
 * Saving beyond the limit is refused instead of silently evicting an older
 * search the user chose to keep.
 */
export function saveDiscoverySearch(
  name: string,
  state: DiscoveryState,
  storage: StorageLike | undefined = browserStorage()
): SavedDiscoverySearch {
  const parsedName = parseSavedSearchName(name);
  const searches = loadSavedDiscoverySearches(storage);

  if (searches.length >= MAX_SAVED_DISCOVERY_SEARCHES) {
    throw new Error(
      `You can keep up to ${MAX_SAVED_DISCOVERY_SEARCHES} saved searches. Delete one to save another.`
    );
  }

  const search = savedDiscoverySearchSchema.parse({
    createdAt: new Date().toISOString(),
    id: createSavedSearchId(),
    name: parsedName,
    state: toSavedDiscoveryState(state)
  });

  writeSearches([search, ...searches], storage);

  return search;
}

/**
 * Renames one saved search. The id and search state are preserved. An unknown
 * id throws so the UI can explain that the search no longer exists (for
 * example after local data was cleared in another tab).
 */
export function renameDiscoverySearch(
  id: string,
  name: string,
  storage: StorageLike | undefined = browserStorage()
): SavedDiscoverySearch[] {
  const parsedName = parseSavedSearchName(name);
  const searches = loadSavedDiscoverySearches(storage);

  if (!searches.some((search) => search.id === id)) {
    throw new Error("That saved search no longer exists on this device.");
  }

  const next = searches.map((search) =>
    search.id === id ? { ...search, name: parsedName } : search
  );

  return writeSearches(next, storage);
}

/** Deletes one saved search. Unknown ids are a no-op. */
export function deleteDiscoverySearch(
  id: string,
  storage: StorageLike | undefined = browserStorage()
): SavedDiscoverySearch[] {
  const searches = loadSavedDiscoverySearches(storage);
  const next = searches.filter((search) => search.id !== id);

  if (next.length === searches.length) {
    return searches;
  }

  return writeSearches(next, storage);
}

/** Removes only the saved-search storage key. */
export function clearSavedDiscoverySearches(
  storage: StorageLike | undefined = browserStorage()
): void {
  storage?.removeItem(SAVED_DISCOVERY_SEARCHES_STORAGE_KEY);
  notifySavedSearchListeners();
}

// Same-tab subscription for `useSyncExternalStore`. The snapshot is cached by
// the raw stored string, so it stays referentially stable between renders and
// reflects writes from Settings or another tab without a separate cache.
const EMPTY_SAVED_SEARCHES: SavedDiscoverySearch[] = [];
const savedSearchListeners = new Set<() => void>();
let snapshotRaw: string | null = null;
let snapshotSearches: SavedDiscoverySearch[] = EMPTY_SAVED_SEARCHES;

export function subscribeSavedDiscoverySearches(listener: () => void): () => void {
  savedSearchListeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === SAVED_DISCOVERY_SEARCHES_STORAGE_KEY) {
      listener();
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }

  return () => {
    savedSearchListeners.delete(listener);

    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

export function getSavedDiscoverySearchesSnapshot(): SavedDiscoverySearch[] {
  const storage = browserStorage();

  if (storage === undefined) {
    return EMPTY_SAVED_SEARCHES;
  }

  const raw = readRaw(storage);

  if (raw !== snapshotRaw) {
    snapshotRaw = raw;
    snapshotSearches = parseSavedSearchesPayload(raw);
  }

  return snapshotSearches;
}

export function getServerSavedDiscoverySearchesSnapshot(): SavedDiscoverySearch[] {
  return EMPTY_SAVED_SEARCHES;
}

function notifySavedSearchListeners(): void {
  for (const listener of savedSearchListeners) {
    listener();
  }
}

function parseSavedSearchesPayload(raw: string | null): SavedDiscoverySearch[] {
  if (raw === null) {
    return EMPTY_SAVED_SEARCHES;
  }

  try {
    const parsed = savedDiscoverySearchesSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : EMPTY_SAVED_SEARCHES;
  } catch {
    return EMPTY_SAVED_SEARCHES;
  }
}

function readRaw(storage: StorageLike): string | null {
  try {
    return storage.getItem(SAVED_DISCOVERY_SEARCHES_STORAGE_KEY);
  } catch {
    // Storage can throw when it is disabled (for example in some private modes).
    return null;
  }
}

function writeSearches(
  searches: SavedDiscoverySearch[],
  storage: StorageLike | undefined
): SavedDiscoverySearch[] {
  // Only the validated schema output is ever serialized.
  const validated = savedDiscoverySearchesSchema.parse(searches);

  storage?.setItem(SAVED_DISCOVERY_SEARCHES_STORAGE_KEY, JSON.stringify(validated));
  notifySavedSearchListeners();

  return validated;
}

function createSavedSearchId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `search_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function browserStorage(): StorageLike | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
