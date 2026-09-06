import { z } from "zod";

import { loadRuntimeConfig, stripTrailingSlash } from "@/config/runtime";
import { networkIdSchema } from "@/config/networks";

export const frontendSettingsStorageKey = "lumenbazaar.frontend.settings.v1";

const walletPreferenceSchema = z.enum(["freighter", "manual", "none"]);

export const frontendSettingsSchema = z.object({
  facilitatorUrl: z.string().url(),
  localDemoMode: z.boolean(),
  network: networkIdSchema,
  walletPreference: walletPreferenceSchema
});

export type WalletPreference = z.infer<typeof walletPreferenceSchema>;
export type FrontendSettings = z.infer<typeof frontendSettingsSchema>;

type StorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;

export function defaultFrontendSettings(): FrontendSettings {
  const config = loadRuntimeConfig();

  return {
    facilitatorUrl: config.apiBaseUrl,
    localDemoMode: config.environment === "local",
    network: config.defaultNetwork,
    walletPreference: "freighter"
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

function browserStorage(): StorageLike | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.localStorage;
}
