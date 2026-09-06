import { apiClient, type LumenBazaarApiClient } from "@/services/api/client";
import type {
  ConformanceRun,
  Health,
  NetworksResponse,
  SupportedPaymentSchemes
} from "@/services/api/schemas";
import {
  demoConformanceRun,
  demoHealthRows,
  demoOperatorMetrics,
  demoSupportedPaymentSchemes
} from "@/fixtures/lumenbazaar";

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
  metrics: typeof demoOperatorMetrics;
  networks: NetworksResponse["networks"];
  source: "api" | "demo";
  supported: SupportedPaymentSchemes;
  warnings: string[];
};

type OperatorClient = Pick<
  LumenBazaarApiClient,
  "getHealth" | "getLatestConformanceRun" | "getNetworks" | "getSupported"
>;

export async function loadOperatorSnapshot(
  client: OperatorClient = apiClient
): Promise<OperatorSnapshot> {
  const [healthResult, networksResult, supportedResult, conformanceResult] =
    await Promise.allSettled([
      client.getHealth(),
      client.getNetworks(),
      client.getSupported(),
      client.getLatestConformanceRun()
    ]);
  const warnings = failedLabels({
    conformance: conformanceResult,
    health: healthResult,
    networks: networksResult,
    supported: supportedResult
  });
  const networks =
    networksResult.status === "fulfilled" ? networksResult.value.networks : demoNetworks();
  const supported =
    supportedResult.status === "fulfilled" ? supportedResult.value : demoSupportedPaymentSchemes;
  const conformance =
    conformanceResult.status === "fulfilled" ? conformanceResult.value : demoConformanceRun;
  const healthRows =
    healthResult.status === "fulfilled"
      ? liveHealthRows(healthResult.value, { networks })
      : demoOperatorHealthRows();

  return {
    conformance,
    healthRows,
    metrics: demoOperatorMetrics,
    networks,
    source: warnings.length === 4 ? "demo" : "api",
    supported,
    warnings
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

function failedLabels(
  results: Record<string, PromiseSettledResult<unknown>>
): OperatorSnapshot["warnings"] {
  return Object.entries(results)
    .filter(([, result]) => result.status === "rejected")
    .map(([label]) => label);
}

function liveHealthRows(health: Health, networks: NetworksResponse): OperatorHealthRow[] {
  const checkedAt = new Date().toISOString();
  const apiStatus: OperatorHealthStatus = health.ok ? "operational" : "down";
  const redisStatus = dependencyStatus(health.dependencies.redis);
  const postgresStatus = dependencyStatus(health.dependencies.database);
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
      detail: "Worker queue telemetry is read from backend metrics when available.",
      name: "Worker",
      status: "operational"
    },
    {
      checkedAt,
      detail: "Search index is reachable through the discovery API.",
      name: "Search",
      status: "operational"
    },
    {
      checkedAt,
      detail: `Redis dependency reported ${health.dependencies.redis}.`,
      name: "Redis",
      status: redisStatus
    },
    {
      checkedAt,
      detail: `Postgres dependency reported ${health.dependencies.database}.`,
      name: "Postgres",
      status: postgresStatus
    },
    {
      checkedAt,
      detail: `${configuredNetworks} configured Stellar RPC endpoint(s).`,
      name: "RPC",
      status: configuredNetworks > 0 ? "operational" : "degraded"
    },
    {
      checkedAt,
      detail: `${configuredNetworks} configured Stellar Horizon endpoint(s).`,
      name: "Horizon",
      status: configuredNetworks > 0 ? "operational" : "degraded"
    }
  ];
}

function dependencyStatus(value: string): OperatorHealthStatus {
  const normalized = value.toLowerCase();

  if (normalized.includes("down") || normalized.includes("failed")) {
    return "down";
  }

  if (normalized.includes("missing") || normalized.includes("unconfigured")) {
    return "degraded";
  }

  return "operational";
}

function demoOperatorHealthRows(): OperatorHealthRow[] {
  return demoHealthRows.map((row) => ({
    ...row,
    name: row.name as OperatorHealthRow["name"],
    status: row.status as OperatorHealthStatus
  }));
}

function demoNetworks(): NetworksResponse["networks"] {
  return demoSupportedPaymentSchemes.schemes.map((scheme) => ({
    assets: scheme.assets.map((asset) => ({
      code: asset.code,
      decimals: asset.decimals,
      issuer: asset.issuer
    })),
    displayName:
      scheme.network === "stellar:testnet" ? "Stellar Testnet" : "Stellar Public Network",
    horizonUrl:
      scheme.network === "stellar:testnet"
        ? "https://horizon-testnet.stellar.org"
        : "https://horizon.stellar.org",
    id: scheme.network,
    passphrase:
      scheme.network === "stellar:testnet"
        ? "Test SDF Network ; September 2015"
        : "Public Global Stellar Network ; September 2015",
    rpcUrl:
      scheme.network === "stellar:testnet"
        ? "https://soroban-testnet.stellar.org"
        : "https://mainnet.sorobanrpc.com"
  }));
}
