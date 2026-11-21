import { z } from "zod";

import { loadRuntimeConfig, stripTrailingSlash } from "@/config/runtime";
import { networkIdSchema } from "@/config/networks";
import { isValidLocale, isValidTimezone } from "@/lib/datetime-formatter";
import {
  SAVED_DISCOVERY_SEARCHES_STORAGE_KEY,
  clearSavedDiscoverySearches
} from "@/services/discovery-saved-searches";

export const frontendSettingsStorageKey = "lumenbazaar.frontend.settings.v1";

const walletPreferenceSchema = z.enum(["freighter", "manual", "none"]);

/** Bounded display densities for discovery results. */
export const discoveryDensitySchema = z.enum(["comfortable", "compact"]);
export type DiscoveryDensity = z.infer<typeof discoveryDensitySchema>;

/**
 * Timezone schema: validates against supported IANA timezone IDs
 * Examples: "UTC", "America/New_York", "Europe/London", "Asia/Tokyo"
 */
const timezoneSchema = z.string().refine(isValidTimezone, "Must be a valid IANA timezone ID");

/**
 * Locale schema: validates against supported BCP 47 locale codes
 * Examples: "en-US", "de-DE", "fr-FR", "ja-JP"
 */
const localeSchema = z.string().refine(isValidLocale, "Must be a valid BCP 47 locale code");

export const frontendSettingsSchema = z.object({
  facilitatorUrl: z.string().url(),
  network: networkIdSchema,
  walletPreference: walletPreferenceSchema,
  /** IANA timezone ID for datetime display (e.g., "America/New_York", "UTC") */
  timezoneId: timezoneSchema,
  /** BCP 47 locale code for formatting (e.g., "en-US", "de-DE") */
  localeCode: localeSchema
});

export type WalletPreference = z.infer<typeof walletPreferenceSchema>;
export type FrontendSettings = z.infer<typeof frontendSettingsSchema>;

import { getDefaultLocale, getDefaultTimezone } from "@/lib/datetime-formatter";

type StorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;

export function defaultFrontendSettings(): FrontendSettings {
  const config = loadRuntimeConfig();

  return {
    facilitatorUrl: config.apiBaseUrl,
    network: config.defaultNetwork,
    walletPreference: "freighter",
    timezoneId: getDefaultTimezone(),
    localeCode: getDefaultLocale()
  };
}

export function loadFrontendSettings(storage: StorageLike | undefined = browserStorage()) {
  const defaults = defaultFrontendSettings();

  if (storage === undefined) {
    return defaults;
  }

  const raw = storage.getItem(frontendSettingsStorageKey);

  if (raw === null) {
    return defaults;
  }

  try {
    return frontendSettingsSchema.parse({
      ...defaults,
      ...JSON.parse(raw)
    });
  } catch {
    return defaults;
  }
}

export function saveFrontendSettings(settings: FrontendSettings, storage = browserStorage()) {
  const parsed = frontendSettingsSchema.parse({
    ...settings,
    facilitatorUrl: stripTrailingSlash(settings.facilitatorUrl)
  });

  storage?.setItem(frontendSettingsStorageKey, JSON.stringify(parsed));
  return parsed;
}

export function resetFrontendSettings(storage = browserStorage()) {
  storage?.removeItem(frontendSettingsStorageKey);
  return defaultFrontendSettings();
}

/** Bounded discovery display density, persisted separately from network settings. */
export const discoveryDensityStorageKey = "lumenbazaar.frontend.discovery-density.v1";

export function loadDiscoveryDensity(
  storage: StorageLike | undefined = browserStorage()
): DiscoveryDensity {
  const raw = storage?.getItem(discoveryDensityStorageKey);

  if (raw === null || raw === undefined) {
    return "comfortable";
  }

  const parsed = discoveryDensitySchema.safeParse(raw);
  return parsed.success ? parsed.data : "comfortable";
}

export function saveDiscoveryDensity(
  density: DiscoveryDensity,
  storage: StorageLike | undefined = browserStorage()
): DiscoveryDensity {
  const parsed = discoveryDensitySchema.parse(density);
  storage?.setItem(discoveryDensityStorageKey, parsed);
  return parsed;
}

export function resetDiscoveryDensity(
  storage: StorageLike | undefined = browserStorage()
): DiscoveryDensity {
  storage?.removeItem(discoveryDensityStorageKey);
  return "comfortable";
}

/**
 * Browser-local keys removed by Settings > "Clear local data": frontend
 * preferences, the discovery density preference, and saved discovery searches.
 *
 * The list is explicit on purpose. Wallet preferences, payment and receipt
 * state, seller drafts, bookmarks, saved transaction views, shared table column
 * preferences, and accessibility settings are never removed by this action.
 */
export const frontendLocalDataStorageKeys = [
  frontendSettingsStorageKey,
  discoveryDensityStorageKey,
  SAVED_DISCOVERY_SEARCHES_STORAGE_KEY
] as const;

/**
 * Clears the frontend's local preference data (see
 * `frontendLocalDataStorageKeys`) and returns the default settings. Nothing is
 * deleted on a server.
 */
export function clearFrontendLocalData(
  storage: StorageLike | undefined = browserStorage()
): FrontendSettings {
  resetFrontendSettings(storage);
  resetDiscoveryDensity(storage);
  clearSavedDiscoverySearches(storage);

  return defaultFrontendSettings();
}

function browserStorage(): StorageLike | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.localStorage;
}
