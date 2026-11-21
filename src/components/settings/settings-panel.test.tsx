import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { parseDiscoveryState } from "@/services/discovery-params";
import {
  SAVED_DISCOVERY_SEARCHES_STORAGE_KEY,
  saveDiscoverySearch
} from "@/services/discovery-saved-searches";
import {
  discoveryDensityStorageKey,
  frontendSettingsStorageKey,
  saveDiscoveryDensity
} from "@/services/settings";

import { SettingsPanel } from "./settings-panel";

const unrelatedKeys = {
  "lumenbazaar.accessibility.theme.v1": "high-contrast",
  "lumenbazaar.frontend.bookmarks.v1": "[]",
  "lumenbazaar.wallet.provider.v1": "freighter",
  lumenbazaar_resource_draft: "{}"
};

beforeEach(() => {
  window.localStorage.clear();
});

describe("SettingsPanel clear local data", () => {
  it("explains the scope before anything is cleared", () => {
    saveDiscoverySearch("Weather", parseDiscoveryState({ q: "weather" }));
    render(<SettingsPanel />);

    const button = screen.getByRole("button", { name: "Clear local data" });

    expect(screen.getByRole("region", { name: "Local data on this device" })).toBeVisible();
    expect(screen.getByText("Saved searches on this device: 1")).toBeVisible();
    expect(button).toHaveAccessibleDescription(/removes your saved discovery searches/);
    expect(button).toHaveAccessibleDescription(/nothing is deleted on a server/);
  });

  it("requires confirmation and can be cancelled without clearing", async () => {
    const user = userEvent.setup();
    saveDiscoverySearch("Weather", parseDiscoveryState({ q: "weather" }));
    render(<SettingsPanel />);

    await user.click(screen.getByRole("button", { name: "Clear local data" }));

    expect(screen.getByText(/This cannot be undone/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Clear local data" })).toHaveFocus();
    expect(window.localStorage.getItem(SAVED_DISCOVERY_SEARCHES_STORAGE_KEY)).not.toBeNull();
  });

  it("removes saved searches and preferences but leaves unrelated data", async () => {
    const user = userEvent.setup();
    for (const [key, value] of Object.entries(unrelatedKeys)) {
      window.localStorage.setItem(key, value);
    }
    saveDiscoverySearch("Weather", parseDiscoveryState({ q: "weather" }));
    saveDiscoverySearch("Maps", parseDiscoveryState({ q: "maps" }));
    saveDiscoveryDensity("compact");
    render(<SettingsPanel />);

    await user.click(screen.getByRole("button", { name: "Manual" }));
    await user.click(screen.getByRole("button", { name: "Save settings" }));
    expect(window.localStorage.getItem(frontendSettingsStorageKey)).toContain("manual");

    await user.click(screen.getByRole("button", { name: "Clear local data" }));
    await user.click(screen.getByRole("button", { name: "Yes, clear local data" }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "Local data cleared. Removed 2 saved searches and reset frontend preferences on this device."
    );
    expect(screen.getByRole("button", { name: "Clear local data" })).toHaveFocus();
    expect(screen.getByText("Saved searches on this device: 0")).toBeVisible();
    expect(screen.getByRole("button", { name: "Freighter" })).toBeInTheDocument();

    expect(window.localStorage.getItem(SAVED_DISCOVERY_SEARCHES_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(frontendSettingsStorageKey)).toBeNull();
    expect(window.localStorage.getItem(discoveryDensityStorageKey)).toBeNull();
    for (const [key, value] of Object.entries(unrelatedKeys)) {
      expect(window.localStorage.getItem(key)).toBe(value);
    }
  });
});
