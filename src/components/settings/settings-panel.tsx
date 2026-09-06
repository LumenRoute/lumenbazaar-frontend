"use client";

import { RotateCcw, Save, Settings } from "lucide-react";
import { useState } from "react";
import { ZodError } from "zod";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { loadRuntimeConfig } from "@/config/runtime";
import {
  frontendSettingsSchema,
  loadFrontendSettings,
  resetFrontendSettings,
  saveFrontendSettings,
  type FrontendSettings,
  type WalletPreference
} from "@/services/settings";

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

  return (
    <>
      <PageHeader
        description="Configure local frontend preferences for network selection, facilitator routing, wallet behavior, and fixture fallback."
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

            <label className="flex items-start gap-3 rounded-md border border-slate-200 p-3 text-sm">
              <input
                checked={settings.localDemoMode}
                className="mt-1 h-4 w-4"
                onChange={(event) => updateSettings({ localDemoMode: event.target.checked })}
                type="checkbox"
              />
              <span>
                <span className="block font-medium text-slate-950">Local demo mode</span>
                <span className="mt-1 block text-slate-600">
                  Use bundled fixtures when local backend endpoints are unavailable.
                </span>
              </span>
            </label>

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
