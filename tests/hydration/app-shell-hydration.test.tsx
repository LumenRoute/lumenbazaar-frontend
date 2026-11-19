/**
 * AppShell Hydration Test
 * 
 * Verifies that the AppShell component (Server Component rendering client components)
 * properly handles hydration without warnings when:
 * - AppShell is rendered as a Server Component with children
 * - WalletStatus client component is nested within server component
 * - Navigation and layout structure maintains consistency
 */

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { captureHydrationWarnings } from "./utils";

describe("AppShell - Hydration", () => {
  let capture: ReturnType<typeof captureHydrationWarnings>["capture"];
  let cleanup: ReturnType<typeof captureHydrationWarnings>["cleanup"];

  beforeEach(() => {
    const hydration = captureHydrationWarnings();
    capture = hydration.capture;
    cleanup = hydration.cleanup;

    // Mock the runtime config
    vi.stubEnv("NEXT_PUBLIC_LUMENBAZAAR_ENV", "demo");
    vi.stubEnv("NEXT_PUBLIC_LUMENBAZAAR_API_URL", "http://localhost:8080");
    vi.stubEnv("NEXT_PUBLIC_LUMENBAZAAR_NETWORK", "stellar:testnet");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("renders without hydration warnings with simple children", () => {
    render(
      <AppShell>
        <div>Test content</div>
      </AppShell>
    );

    expect(screen.getByText("Test content")).toBeInTheDocument();
    expect(capture.getHydrationWarnings()).toHaveLength(0);
  });

  it("displays header with LumenBazaar branding without hydration warnings", () => {
    render(
      <AppShell>
        <div>Main content</div>
      </AppShell>
    );

    expect(screen.getByText("LumenBazaar")).toBeInTheDocument();
    expect(screen.getByText(/Stellar x402 dashboard/)).toBeInTheDocument();
    expect(capture.getHydrationWarnings()).toHaveLength(0);
  });

  it("renders navigation items without hydration warnings", () => {
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    expect(screen.getByRole("link", { name: /Dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Explore/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Seller/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Settings/i })).toBeInTheDocument();

    expect(capture.getHydrationWarnings()).toHaveLength(0);
  });

  it("includes WalletStatus client component without hydration warnings", () => {
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    const connectButton = screen.queryByRole("button", { name: /connect freighter/i });
    expect(connectButton).toBeInTheDocument();
    expect(capture.getHydrationWarnings()).toHaveLength(0);
  });

  it("displays environment indicator without hydration warnings", () => {
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    expect(screen.getByText("Demo data")).toBeInTheDocument();
    expect(capture.getHydrationWarnings()).toHaveLength(0);
  });

  it("renders main content area without hydration mismatch", () => {
    render(
      <AppShell>
        <h1>Page Title</h1>
        <p>Page content</p>
      </AppShell>
    );

    expect(screen.getByRole("heading", { name: "Page Title" })).toBeInTheDocument();
    expect(screen.getByText("Page content")).toBeInTheDocument();
    expect(capture.getHydrationWarnings()).toHaveLength(0);
  });

  it("maintains layout structure through hydration", () => {
    const { container } = render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    const header = container.querySelector("header");
    const nav = container.querySelector("nav");
    const main = container.querySelector("main");

    expect(header).toBeInTheDocument();
    expect(nav).toBeInTheDocument();
    expect(main).toBeInTheDocument();
    expect(capture.getHydrationWarnings()).toHaveLength(0);
  });

  it("renders all 10 navigation links without hydration warnings", () => {
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    const navItems = [
      "Dashboard",
      "Explore",
      "Seller",
      "Playground",
      "Transactions",
      "Operators",
      "Health",
      "Conformance",
      "Docs",
      "Settings"
    ];

    for (const item of navItems) {
      expect(screen.getByRole("link", { name: new RegExp(item, "i") })).toBeInTheDocument();
    }

    expect(capture.getHydrationWarnings()).toHaveLength(0);
  });

  it("handles multiple child components without hydration warnings", () => {
    const ComplexChildren = () => (
      <>
        <header>Header</header>
        <section>Section 1</section>
        <section>Section 2</section>
        <footer>Footer</footer>
      </>
    );

    render(
      <AppShell>
        <ComplexChildren />
      </AppShell>
    );

    expect(screen.getByText("Header")).toBeInTheDocument();
    expect(screen.getAllByText(/Section/).length).toBe(2);
    expect(screen.getByText("Footer")).toBeInTheDocument();
    expect(capture.getHydrationWarnings()).toHaveLength(0);
  });

  it("maintains accessible navigation structure without hydration mismatch", () => {
    const { container } = render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    const nav = container.querySelector('nav[aria-label="Primary navigation"]');
    expect(nav).toBeInTheDocument();
    expect(capture.getHydrationWarnings()).toHaveLength(0);
  });

  it("renders TailwindCSS classes consistently without hydration mismatch", () => {
    const { container } = render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    const header = container.querySelector("header");
    expect(header?.className).toContain("bg-white");
    expect(header?.className).toContain("border-b");

    const main = container.querySelector("main");
    expect(main?.className).toContain("px-");

    expect(capture.getHydrationWarnings()).toHaveLength(0);
  });

  it("handles fragment-wrapped children without hydration warnings", () => {
    const FragmentChildren = () => (
      <>
        <div>First</div>
        <div>Second</div>
      </>
    );

    render(
      <AppShell>
        <FragmentChildren />
      </AppShell>
    );

    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
    expect(capture.getHydrationWarnings()).toHaveLength(0);
  });

  it("logo link points to correct href without hydration mismatch", () => {
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    const logoLink = screen.getByRole("link", { name: /LumenBazaar/ });
    expect(logoLink).toHaveAttribute("href", "/");
    expect(capture.getHydrationWarnings()).toHaveLength(0);
  });

  it("renders responsive navigation without hydration warnings", () => {
    const { container } = render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    const nav = container.querySelector("nav");
    expect(nav?.className).toContain("overflow-x-auto");
    expect(capture.getHydrationWarnings()).toHaveLength(0);
  });
});
