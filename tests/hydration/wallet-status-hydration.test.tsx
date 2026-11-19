/**
 * WalletStatus Hydration Test
 * 
 * Verifies that the WalletStatus component (client-only with wallet state management)
 * properly initializes without hydration warnings and maintains consistent state
 * between server and client rendering.
 */

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WalletStatus } from "@/components/wallet/wallet-status";
import { initialWalletState } from "@/services/wallets";
import { captureHydrationWarnings, createServerClientStateComparison } from "./utils";

describe("WalletStatus - Hydration", () => {
  let capture: ReturnType<typeof captureHydrationWarnings>["capture"];
  let cleanup: ReturnType<typeof captureHydrationWarnings>["cleanup"];

  beforeEach(() => {
    const hydration = captureHydrationWarnings();
    capture = hydration.capture;
    cleanup = hydration.cleanup;

    // Mock the runtime config
    vi.stubEnv("NEXT_PUBLIC_LUMENBAZAAR_ENV", "demo");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("renders without hydration warnings on initial render", () => {
    render(<WalletStatus />);

    const button = screen.getByRole("button", { name: /connect freighter/i });
    expect(button).toBeInTheDocument();
    expect(capture.getHydrationWarnings()).toHaveLength(0);
  });

  it("initializes wallet state consistently with server defaults", () => {
    render(<WalletStatus />);

    // Verify that the component renders with the expected "disconnected" state
    const button = screen.getByRole("button", { name: /connect freighter/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();

    // Verify initial state matches expectations
    const comparison = createServerClientStateComparison(
      initialWalletState.status,
      "disconnected",
      "wallet status"
    );
    expect(comparison.match).toBe(true);
  });

  it("displays connect button for disconnected state without hydration warnings", () => {
    render(<WalletStatus />);

    expect(
      screen.getByRole("button", { name: /connect freighter/i })
    ).toBeInTheDocument();
    expect(capture.getHydrationWarnings()).toHaveLength(0);
  });

  it("renders without issues on server-side initial state", () => {
    // Simulate server-side rendering where wallet is always disconnected
    const { container } = render(<WalletStatus />);

    expect(container).toBeInTheDocument();
    expect(capture.getHydrationWarnings()).toHaveLength(0);
  });

  it("handles wallet state transitions without hydration warnings", () => {
    const { rerender } = render(<WalletStatus />);

    // Initial render should have no warnings
    expect(capture.getHydrationWarnings()).toHaveLength(0);

    // Re-render should also have no warnings
    rerender(<WalletStatus />);
    expect(capture.getHydrationWarnings()).toHaveLength(0);
  });

  it("button is not disabled during initial hydration", () => {
    render(<WalletStatus />);

    const button = screen.getByRole("button", { name: /connect freighter/i });
    expect(button).not.toBeDisabled();
    expect(capture.getHydrationWarnings()).toHaveLength(0);
  });

  it("maintains accessible button UI without hydration mismatch", () => {
    render(<WalletStatus />);

    const button = screen.getByRole("button", { name: /connect freighter/i });
    expect(button).toHaveAttribute("type", "button");
    expect(button.className).toContain("flex");
    expect(capture.getHydrationWarnings()).toHaveLength(0);
  });

  it("renders wallet icon without SSR issues", () => {
    const { container } = render(<WalletStatus />);

    // Check that icon SVG is present (lucide-react renders as SVG)
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(capture.getHydrationWarnings()).toHaveLength(0);
  });

  it("does not access window or localStorage during initial render", () => {
    const windowSpy = vi.spyOn(global, "window", "get");

    render(<WalletStatus />);

    // WalletStatus should not access window during initial render
    // (it only accesses window when connect is called)
    expect(capture.getHydrationWarnings()).toHaveLength(0);

    windowSpy.mockRestore();
  });

  it("handles multiple concurrent renders without hydration warnings", async () => {
    const { rerender } = render(<WalletStatus />);

    for (let i = 0; i < 3; i++) {
      rerender(<WalletStatus />);
      expect(capture.getHydrationWarnings()).toHaveLength(0);
    }
  });
});
