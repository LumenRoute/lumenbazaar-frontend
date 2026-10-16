import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createQueryClient } from "@/services/api/query";

import { OperatorHealthPage, OperatorHealthTable } from "./operator-health-table";

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

describe("OperatorHealthPage", () => {
  it("renders health table when data is successfully loaded", async () => {
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
        <OperatorHealthPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Operator health")).toBeInTheDocument();
    });

    expect(screen.getByText("Live API data")).toBeInTheDocument();
    expect(screen.getByText("Service checks")).toBeInTheDocument();
    expect(screen.getByText("API")).toBeInTheDocument();
  });

  it("renders loading state while fetching operator snapshot", () => {
    const { loadOperatorSnapshot } = require("@/services/operators");
    loadOperatorSnapshot.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(
      <QueryClientProvider client={createQueryClient()}>
        <OperatorHealthPage />
      </QueryClientProvider>
    );

    expect(screen.getByText("Loading dependency health")).toBeInTheDocument();
  });

  it("renders error state when snapshot is unavailable", async () => {
    const { loadOperatorSnapshot } = require("@/services/operators");
    loadOperatorSnapshot.mockRejectedValue(new Error("Backend offline"));

    render(
      <QueryClientProvider client={createQueryClient()}>
        <OperatorHealthPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Dependency health unavailable")).toBeInTheDocument();
    });

    expect(screen.getByText(/could not be verified/i)).toBeInTheDocument();
  });

  it("displays unknown status for all services when API is completely unavailable", async () => {
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
        <OperatorHealthPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("API unavailable")).toBeInTheDocument();
    });

    // Verify all health rows display unknown status
    const unknownBadges = screen.getAllByText("unknown");
    expect(unknownBadges.length).toBe(7); // 7 services in health table

    // Verify warnings are displayed
    expect(screen.getByText("health unavailable")).toBeInTheDocument();
    expect(screen.getByText("readiness unavailable")).toBeInTheDocument();
  });

  it("displays partial outage with mixed operational and unknown states", async () => {
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
          detail: "Search readiness could not be verified.",
          name: "Search",
          status: "unknown"
        },
        {
          checkedAt: "2026-10-15T10:00:00Z",
          detail: "Redis readiness check passed.",
          name: "Redis",
          status: "operational"
        },
        {
          checkedAt: "2026-10-15T10:00:00Z",
          detail: "Database readiness is unavailable.",
          name: "Postgres",
          status: "unknown"
        },
        {
          checkedAt: "2026-10-15T10:00:00Z",
          detail: "RPC readiness check passed.",
          name: "RPC",
          status: "operational"
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
      warnings: ["readiness", "version"]
    });

    render(
      <QueryClientProvider client={createQueryClient()}>
        <OperatorHealthPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Partial API data")).toBeInTheDocument();
    });

    // Verify mixed states are visible
    expect(screen.getAllByText("operational").length).toBeGreaterThan(0);
    expect(screen.getAllByText("unknown").length).toBeGreaterThan(0);

    // Verify warnings are displayed
    expect(screen.getByText("readiness unavailable")).toBeInTheDocument();
    expect(screen.getByText("version unavailable")).toBeInTheDocument();
  });

  it("never renders fixture data in unavailable state", async () => {
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
        <OperatorHealthPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("API unavailable")).toBeInTheDocument();
    });

    // Explicitly verify that demo/fixture data is NOT shown
    expect(screen.queryByText("Explicit demo data")).not.toBeInTheDocument();
    // All statuses should be "unknown"
    const operationalBadges = screen.queryAllByText("operational");
    expect(operationalBadges.length).toBe(0);
  });
});

describe("OperatorHealthTable", () => {
  it("renders all health rows with correct status badges", () => {
    const rows = [
      {
        checkedAt: "2026-10-15T10:00:00Z",
        detail: "API is operational.",
        name: "API" as const,
        status: "operational" as const
      },
      {
        checkedAt: "2026-10-15T10:00:00Z",
        detail: "Worker is unknown.",
        name: "Worker" as const,
        status: "unknown" as const
      },
      {
        checkedAt: "2026-10-15T10:00:00Z",
        detail: "Search is degraded.",
        name: "Search" as const,
        status: "degraded" as const
      },
      {
        checkedAt: "2026-10-15T10:00:00Z",
        detail: "Redis is down.",
        name: "Redis" as const,
        status: "down" as const
      },
      {
        checkedAt: "2026-10-15T10:00:00Z",
        detail: "Postgres is unknown.",
        name: "Postgres" as const,
        status: "unknown" as const
      },
      {
        checkedAt: "2026-10-15T10:00:00Z",
        detail: "RPC is operational.",
        name: "RPC" as const,
        status: "operational" as const
      },
      {
        checkedAt: "2026-10-15T10:00:00Z",
        detail: "Horizon is unknown.",
        name: "Horizon" as const,
        status: "unknown" as const
      }
    ];

    render(<OperatorHealthTable rows={rows} />);

    // Verify all rows are rendered
    expect(screen.getByText("API")).toBeInTheDocument();
    expect(screen.getByText("Worker")).toBeInTheDocument();
    expect(screen.getByText("Search")).toBeInTheDocument();
    expect(screen.getByText("Redis")).toBeInTheDocument();
    expect(screen.getByText("Postgres")).toBeInTheDocument();
    expect(screen.getByText("RPC")).toBeInTheDocument();
    expect(screen.getByText("Horizon")).toBeInTheDocument();

    // Verify status badges
    expect(screen.getAllByText("operational").length).toBe(2);
    expect(screen.getAllByText("unknown").length).toBe(3);
    expect(screen.getByText("degraded")).toBeInTheDocument();
    expect(screen.getByText("down")).toBeInTheDocument();
  });
});
