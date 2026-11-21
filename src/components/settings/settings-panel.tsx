"use client";

import { RotateCcw, Save, Settings, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ZodError } from "zod";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { loadRuntimeConfig } from "@/config/runtime";
import {
  getSavedDiscoverySearchesSnapshot,
  getServerSavedDiscoverySearchesSnapshot,
  subscribeSavedDiscoverySearches
} from "@/services/discovery-saved-searches";
import {
  clearFrontendLocalData,
  frontendSettingsSchema,
  loadFrontendSettings,
  resetFrontendSettings,
  saveFrontendSettings,
  type FrontendSettings,
  type WalletPreference
} from "@/services/settings";
import { getAvailableLocales, getAvailableTimezones } from "@/lib/datetime-formatter";

const walletOptions: Array<{ label: string; value: WalletPreference }> = [
  { label: "Freighter", value: "freighter" },
  { label: "Manual", value: "manual" },
  { label: "None", value: "none" }
];

export function SettingsPanel() {
  const config = loadRuntimeConfig();
  const [settings, setSettings] = useState<FrontendSettings>(() => loadFrontendSettings());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const savedSearches = useSyncExternalStore(
    subscribeSavedDiscoverySearches,
    getSavedDiscoverySearchesSnapshot,
    getServerSavedDiscoverySearchesSnapshot
  );
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [clearStatus, setClearStatus] = useState("");
  const pendingFocusId = useRef<string | null>(null);

  // Return focus to a stable control after the confirmation UI is swapped out.
  useEffect(() => {
    if (pendingFocusId.current === null) return;

    const target = document.getElementById(pendingFocusId.current);
    if (target) {
      target.focus();
      pendingFocusId.current = null;
    }
  });

  function updateSettings(partial: Partial<FrontendSettings>) {
    setError("");
    setMessage("");
    setSettings((current) => ({ ...current, ...partial }));
  }

  function save() {
    try {
      const parsed = saveFrontendSettings(frontendSettingsSchema.parse(settings));
      setSettings(parsed);
      setMessage("Settings saved locally.");
      setError("");
    } catch (reason) {
      setMessage("");
      setError(
        reason instanceof ZodError ? (reason.issues[0]?.message ?? reason.message) : String(reason)
      );
    }
  }

  function reset() {
    const defaults = resetFrontendSettings();
    setSettings(defaults);
    setError("");
    setMessage("Settings reset to runtime defaults.");
  }

  function startClearLocalData() {
    setClearStatus("");
    setConfirmingClear(true);
    pendingFocusId.current = "settings-clear-local-data-cancel";
  }

  function cancelClearLocalData() {
    setConfirmingClear(false);
    pendingFocusId.current = "settings-clear-local-data";
  }

  function confirmClearLocalData() {
    const removedSearches = savedSearches.length;
    const defaults = clearFrontendLocalData();

    setSettings(defaults);
    setMessage("");
    setError("");
    setConfirmingClear(false);
    setClearStatus(
      `Local data cleared. Removed ${removedSearches} saved ${
        removedSearches === 1 ? "search" : "searches"
      } and reset frontend preferences on this device.`
    );
    pendingFocusId.current = "settings-clear-local-data";
  }

  const timezones = getAvailableTimezones();
  const locales = getAvailableLocales();

  return (
    <>
      <PageHeader
        description="Configure local frontend preferences for network selection, facilitator routing, wallet behavior, and datetime formatting."
        title="Settings"
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Frontend preferences</h2>
              <p className="mt-1 text-sm text-slate-600">
                Stored in this browser only; deployment defaults still come from environment
                variables.
              </p>
            </div>
            <Settings aria-hidden="true" className="h-5 w-5 text-teal-700" />
          </CardHeader>
          <CardBody className="space-y-5">
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700">Network</span>
              <select
                className="min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-slate-950"
                onChange={(event) =>
                  updateSettings({
                    network: event.target.value as FrontendSettings["network"]
                  })
                }
                value={settings.network}
              >
                <option value="stellar:testnet">stellar:testnet</option>
                <option disabled={!config.features.enableMainnet} value="stellar:pubnet">
                  stellar:pubnet
                </option>
              </select>
              {!config.features.enableMainnet ? (
                <p className="text-xs text-slate-500">
                  Mainnet remains disabled until `NEXT_PUBLIC_ENABLE_MAINNET=true`.
                </p>
              ) : null}
            </label>

            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700">Facilitator URL</span>
              <input
                className="min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-slate-950"
                onChange={(event) => updateSettings({ facilitatorUrl: event.target.value })}
                placeholder="http://localhost:8080"
                value={settings.facilitatorUrl}
              />
            </label>

            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700">Timezone</span>
              <select
                className="min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-slate-950"
                onChange={(event) => updateSettings({ timezoneId: event.target.value })}
                value={settings.timezoneId}
              >
                {timezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500">
                Controls how timestamps are displayed with timezone abbreviations and offsets.
              </p>
            </label>

            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700">Locale</span>
              <select
                className="min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-slate-950"
                onChange={(event) => updateSettings({ localeCode: event.target.value })}
                value={settings.localeCode}
              >
                {locales.map((locale) => (
                  <option key={locale} value={locale}>
                    {locale}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500">
                Determines language and formatting for dates, times, and numbers.
              </p>
            </label>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-slate-700">Wallet preference</legend>
              <div className="flex flex-wrap gap-2">
                {walletOptions.map((option) => (
                  <Button
                    key={option.value}
                    onClick={() => updateSettings({ walletPreference: option.value })}
                    type="button"
                    variant={settings.walletPreference === option.value ? "primary" : "secondary"}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-wrap gap-2">
              <Button onClick={save} type="button">
                <Save aria-hidden="true" className="h-4 w-4" />
                Save settings
              </Button>
              <Button onClick={reset} type="button" variant="secondary">
                <RotateCcw aria-hidden="true" className="h-4 w-4" />
                Reset
              </Button>
            </div>

            {message ? <Badge tone="success">{message}</Badge> : null}
            {error ? <Badge tone="danger">{error}</Badge> : null}
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-950">Runtime defaults</h2>
              <p className="mt-1 text-sm text-slate-600">
                Values shipped with the current frontend build.
              </p>
            </CardHeader>
            <CardBody className="space-y-3">
              <RuntimeRow label="Environment" value={config.environment} />
              <RuntimeRow label="API base URL" value={config.apiBaseUrl} />
              <RuntimeRow label="Default network" value={config.defaultNetwork} />
              <RuntimeRow
                label="Mainnet enabled"
                value={config.features.enableMainnet ? "true" : "false"}
              />
              <RuntimeRow
                label="MCP inspector"
                value={config.features.enableMcpInspector ? "true" : "false"}
              />
              <RuntimeRow
                label="Upto sessions"
                value={config.features.enableUptoSessions ? "true" : "false"}
              />
            </CardBody>
          </Card>

          <Card>
            <section aria-labelledby="settings-local-data-heading">
              <CardHeader>
                <h2
                  className="text-lg font-semibold text-slate-950"
                  id="settings-local-data-heading"
                >
                  Local data on this device
                </h2>
                <p className="mt-1 text-sm text-slate-600" id="settings-local-data-scope">
                  Clearing local data removes your saved discovery searches, the discovery density
                  preference, and the frontend preferences on this page. It does not affect wallet
                  connections, payment or receipt records, seller drafts, bookmarks, saved
                  transaction views, table columns, or accessibility settings, and nothing is
                  deleted on a server.
                </p>
              </CardHeader>
              <CardBody className="space-y-3">
                <p className="text-sm text-slate-700">
                  Saved searches on this device: {savedSearches.length}
                </p>

                {confirmingClear ? (
                  <div
                    aria-labelledby="settings-clear-local-data-prompt"
                    className="space-y-2 rounded-md border border-red-200 bg-red-50 p-3"
                    role="group"
                  >
                    <p
                      className="text-sm font-medium text-red-900"
                      id="settings-clear-local-data-prompt"
                    >
                      Clear local data from this browser? This cannot be undone.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={confirmClearLocalData} type="button" variant="danger">
                        <Trash2 aria-hidden="true" className="h-4 w-4" />
                        Yes, clear local data
                      </Button>
                      <Button
                        id="settings-clear-local-data-cancel"
                        onClick={cancelClearLocalData}
                        type="button"
                        variant="secondary"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    aria-describedby="settings-local-data-scope"
                    id="settings-clear-local-data"
                    onClick={startClearLocalData}
                    type="button"
                    variant="danger"
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                    Clear local data
                  </Button>
                )}

                <p className="text-sm text-slate-700" role="status">
                  {clearStatus}
                </p>
              </CardBody>
            </section>
          </Card>
        </div>
      </div>
    </>
  );
}

function RuntimeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-slate-200 px-3 py-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <span className="max-w-full break-all text-sm text-slate-950">{value}</span>
    </div>
  );
}
