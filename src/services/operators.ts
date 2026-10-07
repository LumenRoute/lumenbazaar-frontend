import { apiClient, type LumenBazaarApiClient } from "@/services/api/client";
import type {
  ConformanceRun,
  Health,
  NetworksResponse,
  Readiness,
  SupportedPaymentSchemes
} from "@/services/api/schemas";
import { isDemoMode, type RuntimeEnvironment } from "@/config/runtime";
import {
  demoConformanceRun,
  demoHealthRows,
  demoOperatorMetrics,
  demoSupportedPaymentSchemes
} from "@/fixtures/lumenbazaar";
import { currentRuntimeMode } from "@/services/runtime-mode";

export type OperatorHealthStatus = "operational" | "degraded" | "down";

export type OperatorHealthRow = {
  checkedAt: string;
  detail: string;
  name: "API" | "Worker" | "Search" | "Redis" | "Postgres" | "RPC" | "Horizon";
  status: OperatorHealthStatus;
};

export type OperatorSnapshot = {
  conformance: ConformanceRun;
  healthRows: OperatorHealthRow[];
  metrics: {
    queueDepth: Record<string, number | null>;
    settlementLatencyP95Ms: number | null;
    settlementSuccessRate: number | null;
  };
  networks: NetworksResponse["networks"];
  source: "api" | "demo";
  supported: SupportedPaymentSchemes;
  warnings: string[];
};

type OperatorClient = Pick<
  LumenBazaarApiClient,
  "getHealth" | "getLatestConformanceRun" | "getNetworks" | "getReadiness" | "getSupported"
>;

export async function loadOperatorSnapshot(
  client: OperatorClient = apiClient,
  mode: RuntimeEnvironment = currentRuntimeMode()
): Promise<OperatorSnapshot> {
  if (isDemoMode(mode)) {
    return {
      conformance: demoConformanceRun,
      healthRows: demoOperatorHealthRows(),
      metrics: demoOperatorMetrics,
      networks: demoNetworks(),
      source: "demo",
      supported: demoSupportedPaymentSchemes,
      warnings: []
    };
  }

  const [health, readiness, networksResponse, supported, conformance] = await Promise.all([
    client.getHealth(),
    client.getReadiness(),
    client.getNetworks(),
    client.getSupported(),
    client.getLatestConformanceRun()
  ]);
  const networks = networksResponse.networks;

  return {
    conformance,
    healthRows: liveHealthRows(health, readiness, { networks }),
    metrics: {
      queueDepth: { "settlement-confirmation": null },
      settlementLatencyP95Ms: null,
      settlementSuccessRate: null
    },
    networks,
    source: "api",
    supported,
    warnings: ["metrics"]
  };
}

export function conformanceEndpointStatus(
  run: ConformanceRun,
  endpoint: ConformanceRun["results"][number]["endpoint"]
) {
  const results = run.results.filter((result) => result.endpoint === endpoint);

  if (results.some((result) => result.status === "failed")) {
    return "failed";
  }

  if (results.some((result) => result.status === "passed")) {
    return "passed";
  }

  if (results.some((result) => result.status === "reserved")) {
    return "reserved";
  }

  return "missing";
}

export function statusTone(status: OperatorHealthStatus | ConformanceRun["status"] | "reserved") {
  if (status === "operational" || status === "passed") {
    return "success";
  }

  if (status === "degraded" || status === "reserved") {
    return "warning";
  }

  return "danger";
}

function liveHealthRows(
  health: Health,
  readiness: Readiness,
  networks: NetworksResponse
): OperatorHealthRow[] {
  const checkedAt = new Date().toISOString();
  const apiStatus: OperatorHealthStatus = health.ok ? "operational" : "down";
  const configuredNetworks = networks.networks.length;

  return [
    {
      checkedAt,
      detail: `${health.service} responded for ${health.app}.`,
      name: "API",
      status: apiStatus
    },
    {
      checkedAt,
      detail: "Worker queue telemetry is unavailable through the JSON API.",
      name: "Worker",
      status: "degraded"
    },
    {
      checkedAt,
      detail: "Search is available only when backend readiness succeeds.",
      name: "Search",
      status: readiness.ok ? "operational" : "down"
    },
    {
      checkedAt,
      detail: readiness.checks.redis.detail ?? "Redis readiness check completed.",
      name: "Redis",
      status: readinessStatus(readiness.checks.redis.status)
    },
    {
      checkedAt,
      detail: readiness.checks.database.detail ?? "Database readiness check completed.",
      name: "Postgres",
      status: readinessStatus(readiness.checks.database.status)
    },
    {
      checkedAt,
      detail:
        readiness.checks.stellarRpc.detail ??
        `${configuredNetworks} configured Stellar RPC endpoint(s).`,
      name: "RPC",
      status: readinessStatus(readiness.checks.stellarRpc.status)
    },
    {
      checkedAt,
      detail:
        readiness.checks.horizon.detail ??
        `${configuredNetworks} configured Stellar Horizon endpoint(s).`,
      name: "Horizon",
      status: readinessStatus(readiness.checks.horizon.status)
    }
  ];
}

function readinessStatus(
  status: Readiness["checks"][keyof Readiness["checks"]]["status"]
): OperatorHealthStatus {
  if (status === "ready") return "operational";
  if (status === "not_required") return "degraded";
  return "down";
}

function demoOperatorHealthRows(): OperatorHealthRow[] {
  return demoHealthRows.map((row) => ({
    ...row,
    name: row.name as OperatorHealthRow["name"],
    status: row.status as OperatorHealthStatus
  }));
}

function demoNetworks(): NetworksResponse["networks"] {
  return demoSupportedPaymentSchemes.kinds.map((kind) => ({
    assets: (kind.extra?.assets ?? []).map((asset) => ({
      code: asset.code,
      decimals: asset.decimals,
      issuer: asset.issuer
    })),
    displayName: kind.network === "stellar:testnet" ? "Stellar Testnet" : "Stellar Public Network",
    horizonUrl:
      kind.network === "stellar:testnet"
        ? "https://horizon-testnet.stellar.org"
        : "https://horizon.stellar.org",
    id: kind.network,
    passphrase:
      kind.network === "stellar:testnet"
        ? "Test SDF Network ; September 2015"
        : "Public Global Stellar Network ; September 2015",
    rpcUrl:
      kind.network === "stellar:testnet"
        ? "https://soroban-testnet.stellar.org"
        : "https://mainnet.sorobanrpc.com"
  }));
}
