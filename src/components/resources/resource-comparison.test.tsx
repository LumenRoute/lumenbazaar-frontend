import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { demoResources } from "@/fixtures/lumenbazaar";

import { ResourceComparison } from "./resource-comparison";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("ResourceComparison", () => {
  it("renders mobile cards and a desktop table for a demo comparison", async () => {
    vi.stubEnv("NEXT_PUBLIC_LUMENBAZAAR_ENV", "demo");
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ResourceComparison resourceIds={[demoResources[0]!.id, demoResources[1]!.id]} />
      </QueryClientProvider>
    );

    expect(await screen.findByText("Compare resources")).toBeInTheDocument();
    expect(screen.getByTestId("comparison-mobile")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Paid resource comparison" })).toBeInTheDocument();
    expect(screen.getAllByText("Asset contract").length).toBeGreaterThan(0);
    expect(screen.queryByText("Live API records")).not.toBeInTheDocument();
    expect(screen.getByText("Explicit demo records")).toBeInTheDocument();
  });

  it("asks for a selection when fewer than two resources are provided", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ResourceComparison resourceIds={[]} />
      </QueryClientProvider>
    );

    expect(await screen.findByText("Select resources to compare")).toBeInTheDocument();
  });
});
