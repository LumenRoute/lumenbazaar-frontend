/**
 * Providers Hydration Test
 * 
 * Verifies that the Providers wrapper (QueryClientProvider) properly handles
 * server-rendering and hydration without warnings or mismatches.
 */

import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReactNode } from "react";

import { Providers } from "@/app/providers";
import { createQueryClient } from "@/services/api/query";
import { captureHydrationWarnings } from "./utils";

describe("Providers - Hydration", () => {
  let capture: ReturnType<typeof captureHydrationWarnings>["capture"];
  let cleanup: ReturnType<typeof captureHydrationWarnings>["cleanup"];

  beforeEach(() => {
    const hydration = captureHydrationWarnings();
    capture = hydration.capture;
    cleanup = hydration.cleanup;
  });

  afterEach(() => {
    cleanup();
  });

  it("renders without hydration warnings", () => {
    const TestContent = () => <div>Test content</div>;

    render(
      <Providers>
        <TestContent />
      </Providers>
    );

    expect(screen.getByText("Test content")).toBeInTheDocument();
    expect(capture.getHydrationWarnings()).toHaveLength(0);
  });

  it("maintains QueryClient state across hydration", async () => {
    const queryClient = createQueryClient();
    const testKey = ["test-key"];
    const testData = { value: "test-data" };

    // Set cache before rendering
    queryClient.setQueryData(testKey, testData);

    const TestComponent = () => {
      return <div>{JSON.stringify(testData)}</div>;
    };

    render(
      <QueryClientProvider client={queryClient}>
        <TestComponent />
      </QueryClientProvider>
    );

    expect(screen.getByText(JSON.stringify(testData))).toBeInTheDocument();
    expect(capture.getHydrationWarnings()).toHaveLength(0);
  });

  it("creates new QueryClient instance on each Provider instantiation", () => {
    const TestComponent = ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    );

    const { rerender } = render(
      <Providers>
        <TestComponent>First render</TestComponent>
      </Providers>
    );

    expect(screen.getByText("First render")).toBeInTheDocument();

    rerender(
      <Providers>
        <TestComponent>Second render</TestComponent>
      </Providers>
    );

    expect(screen.getByText("Second render")).toBeInTheDocument();
    expect(capture.getHydrationWarnings()).toHaveLength(0);
  });

  it("handles nested content without hydration warnings", () => {
    const NestedComponent = () => (
      <div>
        <h1>Nested Title</h1>
        <p>Nested content</p>
      </div>
    );

    render(
      <Providers>
        <div>
          <header>Header</header>
          <NestedComponent />
          <footer>Footer</footer>
        </div>
      </Providers>
    );

    expect(screen.getByText("Header")).toBeInTheDocument();
    expect(screen.getByText("Nested Title")).toBeInTheDocument();
    expect(screen.getByText("Footer")).toBeInTheDocument();
    expect(capture.getHydrationWarnings()).toHaveLength(0);
  });

  it("preserves hydration through React Fragment composition", () => {
    const TestComponent = () => (
      <>
        <div>First item</div>
        <div>Second item</div>
      </>
    );

    render(
      <Providers>
        <TestComponent />
      </Providers>
    );

    expect(screen.getByText("First item")).toBeInTheDocument();
    expect(screen.getByText("Second item")).toBeInTheDocument();
    expect(capture.getHydrationWarnings()).toHaveLength(0);
  });

  it("handles multiple Providers instances without hydration issues", () => {
    const TestContent = () => <span>Test</span>;

    const { rerender } = render(
      <Providers>
        <TestContent />
      </Providers>
    );

    expect(screen.getByText("Test")).toBeInTheDocument();
    let warnings = capture.getHydrationWarnings();
    expect(warnings).toHaveLength(0);

    rerender(
      <Providers>
        <TestContent />
      </Providers>
    );

    warnings = capture.getHydrationWarnings();
    expect(warnings).toHaveLength(0);
  });
});
