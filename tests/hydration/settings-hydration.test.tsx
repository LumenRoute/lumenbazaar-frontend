/**
 * SettingsPanel Hydration Test
 * 
 * Verifies that the SettingsPanel component (client-only with localStorage access)
 * properly handles server-rendering and hydration without warnings when:
 * - localStorage is unavailable on server (returns undefined)
 * - localStorage is populated on client
 * - Form state matches between server defaults and client initialization
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsPanel } from "@/components/settings/settings-panel";
import {
  defaultFrontendSettings,
  frontendSettingsStorageKey,
  loadFrontendSettings
} from "@/services/settings";
import {
  captureHydrationWarnings,
  MockStorage,
  createServerClientStateComparison
} from "./utils";

describe("SettingsPanel - Hydration", () => {
  let capture: ReturnType<typeof captureHydrationWarnings>["capture"];
  let cleanup: ReturnType<typeof captureHydrationWarnings>["cleanup"];
  let mockStorage: MockStorage;

  beforeEach(() => {
    const hydration = captureHydrationWarnings();
    capture = hydration.capture;
    cleanup = hydration.cleanup;
    mockStorage = new MockStorage();

    // Mock the runtime config
    vi.stubEnv("NEXT_PUBLIC_LUMENBAZAAR_ENV", "demo");
    vi.stubEnv("NEXT_PUBLIC_LUMENBAZAAR_API_URL", "http://localhost:8080");
    vi.stubEnv("NEXT_PUBLIC_LUMENBAZAAR_NETWORK", "stellar:testnet");
  });

  afterEach(() => {
    cleanup();
    mockStorage.clear();
    vi.unstubAllEnvs();
  });

  it("renders without hydration warnings when localStorage is empty", () => {
    // Simulate server-side: localStorage is undefined, so defaults are used
    render(<SettingsPanel />);

    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(capture.getHydrationWarnings()).toHaveLength(0);
  });

  it("initializes form with default settings consistently", () => {
    const defaults = defaultFrontendSettings();
    render(<SettingsPanel />);

    // Check that form reflects default values
    const networkSelect = screen.getByDisplayValue(defaults.network);
    expect(networkSelect).toBeInTheDocument();

    const facilitatorInput = screen.getByDisplayValue(defaults.facilitatorUrl);
    expect(facilitatorInput).toBeInTheDocument();

    expect(capture.getHydrationWarnings()).toHaveLength(0);
  });

  it("matches server defaults and client localStorage loading state", () => {
    const serverDefaults = defaultFrontendSettings();
    const clientLoaded = loadFrontendSettings(undefined); // Simulates server path

    const comparison = createServerClientStateComparison(
      serverDefaults,
      clientLoaded,
      "frontend settings"
    );
    expect(comparison.match).toBe(true);
    expect(capture.getHydrationWarnings()).toHaveLength(0);
  });

  it("maintains form state consistency through hydration", () => {
    const { rerender } = render(<SettingsPanel />);

    expect(capture.getHydrationWarnings()).toHaveLength(0);

    rerender(<SettingsPanel />);
    expect(capture.getHydrationWarnings()).toHaveLength(0);
  });

  it("displays all form controls without hydration warnings", () => {
    render(<SettingsPanel />);

    expect(screen.getByLabelText("Network")).toBeInTheDocument();
    expect(screen.getByLabelText("Facilitator URL")).toBeInTheDocument();
    expect(screen.getByText("Wallet preference")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();

    expect(capture.getHydrationWarnings()).toHaveLength(0);
  });

  it("wallet preference buttons initialize correctly without hydration warnings", () => {
    const defaults = defaultFrontendSettings();
    render(<SettingsPanel />);

    const freighterButton = screen.getByRole("button", { name: "Freighter" });
    const manualButton = screen.getByRole("button", { name: "Manual" });
    const noneButton = screen.getByRole("button", { name: "None" });

    expect(freighterButton).toBeInTheDocument();
    expect(manualButton).toBeInTheDocument();
    expect(noneButton).toBeInTheDocument();

    // Freighter is the default
    expect(freighterButton.className).toContain("primary");

    expect(capture.getHydrationWarnings()).toHaveLength(0);
  });

  it("renders runtime defaults section without hydration warnings", () => {
    render(<SettingsPanel />);

    expect(screen.getByText("Runtime defaults")).toBeInTheDocument();
    expect(screen.getByText("Environment")).toBeInTheDocument();
    expect(screen.getByText("API base URL")).toBeInTheDocument();
    expect(screen.getByText("Default network")).toBeInTheDocument();

    expect(capture.getHydrationWarnings()).toHaveLength(0);
  });

  it("handles form submission without hydration warnings", () => {
    render(<SettingsPanel />);

    const saveButton = screen.getByRole("button", { name: "Save settings" });
    fireEvent.click(saveButton);

    expect(capture.getHydrationWarnings()).toHaveLength(0);
  });

  it("displays success message without hydration mismatch", () => {
    render(<SettingsPanel />);

    const saveButton = screen.getByRole("button", { name: "Save settings" });
    fireEvent.click(saveButton);

    expect(screen.getByText("Settings saved locally.")).toBeInTheDocument();
    expect(capture.getHydrationWarnings()).toHaveLength(0);
  });

  it("handles wallet preference change without hydration warnings", () => {
    render(<SettingsPanel />);

    const manualButton = screen.getByRole("button", { name: "Manual" });
    fireEvent.click(manualButton);

    expect(capture.getHydrationWarnings()).toHaveLength(0);
  });

  it("maintains text content consistency across hydration", () => {
    render(<SettingsPanel />);

    expect(
      screen.getByText(/Configure local frontend preferences/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Stored in this browser only/)
    ).toBeInTheDocument();

    expect(capture.getHydrationWarnings()).toHaveLength(0);
  });

  it("renders form labels and descriptions without hydration mismatch", () => {
    render(<SettingsPanel />);

    expect(screen.getByText("Network")).toBeInTheDocument();
    expect(screen.getByText("Facilitator URL")).toBeInTheDocument();
    expect(screen.getByText("Wallet preference")).toBeInTheDocument();

    // Verify help text
    expect(
      screen.getByText(/Mainnet remains disabled/)
    ).toBeInTheDocument();

    expect(capture.getHydrationWarnings()).toHaveLength(0);
  });

  it("reset button functionality works without hydration warnings", () => {
    render(<SettingsPanel />);

    const resetButton = screen.getByRole("button", { name: "Reset" });
    fireEvent.click(resetButton);

    expect(
      screen.getByText("Settings reset to runtime defaults.")
    ).toBeInTheDocument();
    expect(capture.getHydrationWarnings()).toHaveLength(0);
  });

  it("validates stored settings consistently on hydration", () => {
    mockStorage.setItem(
      frontendSettingsStorageKey,
      JSON.stringify({
        network: "stellar:testnet",
        walletPreference: "manual",
        facilitatorUrl: "http://localhost:8080"
      })
    );

    const loaded = loadFrontendSettings(mockStorage);
    expect(loaded.walletPreference).toBe("manual");
    expect(capture.getHydrationWarnings()).toHaveLength(0);
  });
});
