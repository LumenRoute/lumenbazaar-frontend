import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createQueryClient } from "@/services/api/query";

import { OperatorDashboard } from "./operator-dashboard";

// Mock the operator service
vi.mock("@/services/operators", async () => {
  const actual = await vi.importActual<typeof import("@/services/operators")>(
    "@/services/operators"
  );
  return {
    ...actual,
    loadOperatorSnapshot: vi.fn()
  };
});

describe("OperatorDashboard", () => {
  it("renders operator status when data is successfully loaded", async () => {
    const { loadOperatorSnapshot } = require("@/services/operators");
    loadOperatorSnapshot.mockResolvedValue({
      checkedAt: "2026-10-15T10:00:00Z",
      conformance: null,
      healthRows: [
        {
          checkedAt: "2026-10-15T10:00:00Z",
          detail: "lumenbazaar-backend responded for api.",
          name: "API",
          status: "operational"
        },
        {
          checkedAt: "2026-10-15T10:00:00Z",
          detail: "Worker queue telemetry is unavailable through the JSON API.",
          name: "Worker",
          status: "unknown"
        },
        {
          checkedAt: "2026-10-15T10:00:00Z",
          detail: "Search follows backend readiness.",
          name: "Search",
          status: "operational"
        },
        {
          checkedAt: "2026-10-15T10:00:00Z",
          detail: "Redis readiness check passed.",
          name: "Redis",
          status: "operational"
        },
        {
          checkedAt: "2026-10-15T10:00:00Z",
          detail: "Database readiness check passed.",
          name: "Postgres",
          status: "operational"
        },
        {
          checkedAt: "2026-10-15T10:00:00Z",
          detail: "RPC readiness check passed.",
          name: "RPC",
          status: "operational"
        },
        {
          checkedAt: "2026-10-15T10:00:00Z",
          detail: "Horizon readiness check passed.",
          name: "Horizon",
          status: "operational"
        }
      ],
      metrics: {
        queueDepth: { "settlement-confirmation": null },
        settlementLatencyP95Ms: null,
        settlementSuccessRate: null
      },
      networks: [],
      source: "api" as const,
      supported: { extensions: [], kinds: [], signers: {} },
      version: {
        commit: "abc123",
        environment: "testnet",
        service: "lumenbazaar-backend",
        version: "0.1.0"
      },
      warnings: []
    });

    render(
      <QueryClientProvider client={createQueryClient()}>
        <OperatorDashboard />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Operator dashboard")).toBeInTheDocument();
    });

    expect(screen.getByText("Live API data")).toBeInTheDocument();
    expect(screen.getByText("operational")).toBeInTheDocument();
    expect(screen.getByText("API")).toBeInTheDocument();
  });

  it("renders loading state while fetching operator snapshot", () => {
    const { loadOperatorSnapshot } = require("@/services/operators");
    loadOperatorSnapshot.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(
      <QueryClientProvider client={createQueryClient()}>
        <OperatorDashboard />
      </QueryClientProvider>
    );

    expect(screen.getByText("Loading operator status")).toBeInTheDocument();
  });

  it("renders error state when snapshot is unavailable", async () => {
    const { loadOperatorSnapshot } = require("@/services/operators");
    loadOperatorSnapshot.mockRejectedValue(new Error("Backend offline"));

    render(
      <QueryClientProvider client={createQueryClient()}>
        <OperatorDashboard />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Operator state unavailable")).toBeInTheDocument();
    });

    expect(screen.getByText(/could not be verified/i)).toBeInTheDocument();
  });

  it("displays unknown states for unavailable metrics in partial outage", async () => {
    const { loadOperatorSnapshot } = require("@/services/operators");
    loadOperatorSnapshot.mockResolvedValue({
      checkedAt: "2026-10-15T10:00:00Z",
      conformance: null,
      healthRows: [
        {
          checkedAt: "2026-10-15T10:00:00Z",
          detail: "API health could not be verified.",
          name: "API",
          status: "unknown"
        },
        {
          checkedAt: "2026-10-15T10:00:00Z",
          detail: "Worker queue telemetry is unavailable through the JSON API.",
          name: "Worker",
          status: "unknown"
        },
        {
          checkedAt: "2026-10-15T10:00:00Z",
          detail: "Search readiness could not be verified.",
          name: "Search",
          status: "unknown"
        },
        {
          checkedAt: "2026-10-15T10:00:00Z",
          detail: "Redis readiness is unavailable.",
          name: "Redis",
          status: "unknown"
        },
        {
          checkedAt: "2026-10-15T10:00:00Z",
          detail: "Database readiness is unavailable.",
          name: "Postgres",
          status: "unknown"
        },
        {
          checkedAt: "2026-10-15T10:00:00Z",
          detail: "RPC readiness is unavailable.",
          name: "RPC",
          status: "unknown"
        },
        {
          checkedAt: "2026-10-15T10:00:00Z",
          detail: "Horizon readiness is unavailable.",
          name: "Horizon",
          status: "unknown"
        }
      ],
      metrics: {
        queueDepth: { "settlement-confirmation": null },
        settlementLatencyP95Ms: null,
        settlementSuccessRate: null
      },
      networks: [],
      source: "partial" as const,
      supported: { extensions: [], kinds: [], signers: {} },
      version: null,
      warnings: ["health", "readiness", "version"]
    });

    render(
      <QueryClientProvider client={createQueryClient()}>
        <OperatorDashboard />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Partial API data")).toBeInTheDocument();
    });

    // Verify unknown states are displayed
    const unknownBadges = screen.getAllByText("unknown");
    expect(unknownBadges.length).toBeGreaterThan(0);

    // Verify warnings are displayed
    expect(screen.getByText("health unavailable")).toBeInTheDocument();
    expect(screen.getByText("readiness unavailable")).toBeInTheDocument();
    expect(screen.getByText("version unavailable")).toBeInTheDocument();
  });

  it("displays all services as unknown and unavailable badge when completely offline", async () => {
    const { loadOperatorSnapshot } = require("@/services/operators");
    loadOperatorSnapshot.mockResolvedValue({
      checkedAt: "2026-10-15T10:00:00Z",
      conformance: null,
      healthRows: [
        {
          checkedAt: "2026-10-15T10:00:00Z",
          detail: "API health could not be verified.",
          name: "API",
          status: "unknown"
        },
        {
          checkedAt: "2026-10-15T10:00:00Z",
          detail: "Worker queue telemetry is unavailable through the JSON API.",
          name: "Worker",
          status: "unknown"
        },
        {
          checkedAt: "2026-10-15T10:00:00Z",
          detail: "Search readiness could not be verified.",
          name: "Search",
          status: "unknown"
        },
        {
          checkedAt: "2026-10-15T10:00:00Z",
          detail: "Redis readiness is unavailable.",
          name: "Redis",
          status: "unknown"
        },
        {
          checkedAt: "2026-10-15T10:00:00Z",
          detail: "Database readiness is unavailable.",
          name: "Postgres",
          status: "unknown"
        },
        {
          checkedAt: "2026-10-15T10:00:00Z",
          detail: "RPC readiness is unavailable.",
          name: "RPC",
          status: "unknown"
        },
        {
          checkedAt: "2026-10-15T10:00:00Z",
          detail: "Horizon readiness is unavailable.",
          name: "Horizon",
          status: "unknown"
        }
      ],
      metrics: {
        queueDepth: { "settlement-confirmation": null },
        settlementLatencyP95Ms: null,
        settlementSuccessRate: null
      },
      networks: [],
      source: "unavailable" as const,
      supported: { extensions: [], kinds: [], signers: {} },
      version: null,
      warnings: [
        "health",
        "readiness",
        "networks",
        "supported",
        "conformance",
        "version",
        "metrics"
      ]
    });

    render(
      <QueryClientProvider client={createQueryClient()}>
        <OperatorDashboard />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("API unavailable")).toBeInTheDocument();
    });

    // Verify all services show unknown status
    const unknownBadges = screen.getAllByText("unknown");
    expect(unknownBadges.length).toBeGreaterThanOrEqual(4); // At least API, Queue depth, p95, success rate

    // Verify no fixture data is rendered (no demo or operational without valid data)
    expect(screen.queryByText("Explicit demo data")).not.toBeInTheDocument();
  });

  it("never renders fixture data in non-demo modes", async () => {
    const { loadOperatorSnapshot } = require("@/services/operators");
    loadOperatorSnapshot.mockResolvedValue({
      checkedAt: "2026-10-15T10:00:00Z",
      conformance: null,
      healthRows: [
        {
          checkedAt: "2026-10-15T10:00:00Z",
          detail: "API health could not be verified.",
          name: "API",
          status: "unknown"
        },
        {
          checkedAt: "2026-10-15T10:00:00Z",
          detail: "Worker queue telemetry is unavailable through the JSON API.",
          name: "Worker",
          status: "unknown"
        },
        {
          checkedAt: "2026-10-15T10:00:00Z",
          detail: "Search readiness could not be verified.",
          name: "Search",
          status: "unknown"
        },
        {
          checkedAt: "2026-10-15T10:00:00Z",
          detail: "Redis readiness is unavailable.",
          name: "Redis",
          status: "unknown"
        },
        {
          checkedAt: "2026-10-15T10:00:00Z",
          detail: "Database readiness is unavailable.",
          name: "Postgres",
          status: "unknown"
        },
        {
          checkedAt: "2026-10-15T10:00:00Z",
          detail: "RPC readiness is unavailable.",
          name: "RPC",
          status: "unknown"
        },
        {
          checkedAt: "2026-10-15T10:00:00Z",
          detail: "Horizon readiness is unavailable.",
          name: "Horizon",
          status: "unknown"
        }
      ],
      metrics: {
        queueDepth: { "settlement-confirmation": null },
        settlementLatencyP95Ms: null,
        settlementSuccessRate: null
      },
      networks: [],
      source: "unavailable" as const,
      supported: { extensions: [], kinds: [], signers: {} },
      version: null,
      warnings: [
        "health",
        "readiness",
        "networks",
        "supported",
        "conformance",
        "version",
        "metrics"
      ]
    });

    render(
      <QueryClientProvider client={createQueryClient()}>
        <OperatorDashboard />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("API unavailable")).toBeInTheDocument();
    });

    // Explicitly verify that fixture data is NOT shown
    expect(screen.queryByText("Explicit demo data")).not.toBeInTheDocument();
    // Should not have any "operational" statuses from fixtures
    // Only "unknown" statuses should appear
    const badges = screen.getAllByRole("button").filter((b) => b.textContent?.includes("operational"));
    expect(badges.length).toBe(0);
  });
});
