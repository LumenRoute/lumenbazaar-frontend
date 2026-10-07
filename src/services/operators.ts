import { apiClient, type LumenBazaarApiClient } from "@/services/api/client";
import type {
  ConformanceRun,
  Health,
  NetworksResponse,
  Readiness,
  SupportedPaymentSchemes,
  Version
} from "@/services/api/schemas";
import { isDemoMode, type RuntimeEnvironment } from "@/config/runtime";
import {
  demoConformanceRun,
  demoHealthRows,
  demoOperatorMetrics,
  demoSupportedPaymentSchemes
} from "@/fixtures/lumenbazaar";
import { currentRuntimeMode } from "@/services/runtime-mode";

export type OperatorHealthStatus = "operational" | "degraded" | "down" | "unknown";

export type OperatorHealthRow = {
  checkedAt: string;
  detail: string;
  name: "API" | "Worker" | "Search" | "Redis" | "Postgres" | "RPC" | "Horizon";
  status: OperatorHealthStatus;
};

export type OperatorSnapshot = {
  checkedAt: string;
  conformance: ConformanceRun | null;
  healthRows: OperatorHealthRow[];
  metrics: {
    queueDepth: Record<string, number | null>;
    settlementLatencyP95Ms: number | null;
    settlementSuccessRate: number | null;
  };
  networks: NetworksResponse["networks"];
  source: "api" | "demo" | "partial" | "unavailable";
  supported: SupportedPaymentSchemes;
  version: Version | null;
  warnings: string[];
};

type OperatorClient = Pick<
  LumenBazaarApiClient,
  | "getHealth"
  | "getLatestConformanceRun"
  | "getNetworks"
  | "getReadiness"
  | "getSupported"
  | "getVersion"
>;

export async function loadOperatorSnapshot(
  client: OperatorClient = apiClient,
  mode: RuntimeEnvironment = currentRuntimeMode()
): Promise<OperatorSnapshot> {
  if (isDemoMode(mode)) {
    const checkedAt = new Date().toISOString();
    return {
      checkedAt,
      conformance: demoConformanceRun,
      healthRows: demoOperatorHealthRows(),
      metrics: demoOperatorMetrics,
      networks: demoNetworks(),
      source: "demo",
      supported: demoSupportedPaymentSchemes,
      version: {
        commit: "demo-build",
        environment: "demo",
        service: "lumenbazaar-backend",
        version: "0.1.0"
      },
      warnings: []
    };
  }

  const checkedAt = new Date().toISOString();
  const [health, readiness, networksResponse, supported, conformance, version] =
    await Promise.allSettled([
      client.getHealth(),
      client.getReadiness(),
      client.getNetworks(),
      client.getSupported(),
      client.getLatestConformanceRun(),
      client.getVersion()
    ]);
  const networks = networksResponse.status === "fulfilled" ? networksResponse.value.networks : [];
  const results = {
    health,
    readiness,
    networks: networksResponse,
    supported,
    conformance,
    version
  };
  const unavailable = Object.entries(results)
    .filter(([, result]) => result.status === "rejected")
    .map(([name]) => name);
  const successful = Object.keys(results).length - unavailable.length;

  return {
    checkedAt,
    conformance: conformance.status === "fulfilled" ? conformance.value : null,
    healthRows: liveHealthRows(
      health.status === "fulfilled" ? health.value : undefined,
      readiness.status === "fulfilled" ? readiness.value : undefined,
      { networks },
      checkedAt
    ),
    metrics: {
      queueDepth: { "settlement-confirmation": null },
      settlementLatencyP95Ms: null,
      settlementSuccessRate: null
    },
    networks,
    source: successful === 0 ? "unavailable" : unavailable.length === 0 ? "api" : "partial",
    supported:
      supported.status === "fulfilled"
        ? supported.value
        : { extensions: [], kinds: [], signers: {} },
    version: version.status === "fulfilled" ? version.value : null,
    warnings: [...unavailable, "metrics"]
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

  if (status === "unknown") return "neutral";

  return "danger";
}

function liveHealthRows(
  health: Health | undefined,
  readiness: Readiness | undefined,
  networks: NetworksResponse,
  checkedAt: string
): OperatorHealthRow[] {
  const apiStatus: OperatorHealthStatus =
    health === undefined ? "unknown" : health.ok ? "operational" : "down";
  const configuredNetworks = networks.networks.length;

  return [
    {
      checkedAt,
      detail:
        health === undefined
          ? "API health could not be verified."
          : `${health.service} responded for ${health.app}.`,
      name: "API",
      status: apiStatus
    },
    {
      checkedAt,
      detail: "Worker queue telemetry is unavailable through the JSON API.",
      name: "Worker",
      status: "unknown"
    },
    {
      checkedAt,
      detail:
        readiness === undefined
          ? "Search readiness could not be verified."
          : "Search follows backend readiness.",
      name: "Search",
      status: readiness === undefined ? "unknown" : readiness.ok ? "operational" : "down"
    },
    {
      checkedAt,
      detail: readiness?.checks.redis.detail ?? "Redis readiness is unavailable.",
      name: "Redis",
      status: readiness === undefined ? "unknown" : readinessStatus(readiness.checks.redis.status)
    },
    {
      checkedAt,
      detail: readiness?.checks.database.detail ?? "Database readiness is unavailable.",
      name: "Postgres",
      status:
        readiness === undefined ? "unknown" : readinessStatus(readiness.checks.database.status)
    },
    {
      checkedAt,
      detail:
        readiness?.checks.stellarRpc.detail ??
        `${configuredNetworks} configured Stellar RPC endpoint(s).`,
      name: "RPC",
      status:
        readiness === undefined ? "unknown" : readinessStatus(readiness.checks.stellarRpc.status)
    },
    {
      checkedAt,
      detail:
        readiness?.checks.horizon.detail ??
        `${configuredNetworks} configured Stellar Horizon endpoint(s).`,
      name: "Horizon",
      status: readiness === undefined ? "unknown" : readinessStatus(readiness.checks.horizon.status)
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
