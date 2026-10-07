import { apiClient, type LumenBazaarApiClient } from "@/services/api/client";
import { isDemoMode, type RuntimeEnvironment } from "@/config/runtime";
import { demoDashboardMetrics } from "@/fixtures/lumenbazaar";
import { currentRuntimeMode } from "@/services/runtime-mode";

export type DashboardMetrics = {
  activeSellerCount: number | null;
  apiUptimeSeconds: number | null;
  indexedResourceCount: number | null;
  latestConformanceStatus: string;
  settledPaymentCount: number | null;
  settlementVolumeByNetwork: Record<string, number>;
  supportedNetworks: string[];
};

export type DashboardSnapshot = {
  checkedAt: string;
  metrics: DashboardMetrics;
  source: "api" | "demo" | "partial" | "unavailable";
  warnings: string[];
};

type DashboardClient = Pick<
  LumenBazaarApiClient,
  "getHealth" | "getLatestConformanceRun" | "getNetworks" | "listResources"
>;

export async function loadDashboardSnapshot(
  client: DashboardClient = apiClient,
  mode: RuntimeEnvironment = currentRuntimeMode()
): Promise<DashboardSnapshot> {
  if (isDemoMode(mode)) {
    return {
      checkedAt: new Date().toISOString(),
      metrics: demoDashboardMetrics,
      source: "demo",
      warnings: []
    };
  }

  const [resourcesResult, healthResult, networksResult, conformanceResult] =
    await Promise.allSettled([
      client.listResources({ limit: 100 }),
      client.getHealth(),
      client.getNetworks(),
      client.getLatestConformanceRun()
    ]);
  const warnings = failedLabels({
    conformance: conformanceResult,
    health: healthResult,
    networks: networksResult,
    resources: resourcesResult
  });
  const resources = resourcesResult.status === "fulfilled" ? resourcesResult.value.resources : null;
  const networks =
    networksResult.status === "fulfilled"
      ? networksResult.value.networks.map((network) => network.id)
      : [];
  const conformanceStatus =
    conformanceResult.status === "fulfilled" ? conformanceResult.value.status : "unavailable";

  return {
    checkedAt: new Date().toISOString(),
    metrics: {
      activeSellerCount: null,
      apiUptimeSeconds: null,
      indexedResourceCount: resources?.length ?? null,
      latestConformanceStatus: conformanceStatus,
      settledPaymentCount: null,
      settlementVolumeByNetwork: {},
      supportedNetworks: networks
    },
    source: warnings.length === 0 ? "api" : warnings.length === 4 ? "unavailable" : "partial",
    warnings
  };
}

function failedLabels(
  results: Record<string, PromiseSettledResult<unknown>>
): DashboardSnapshot["warnings"] {
  return Object.entries(results)
    .filter(([, result]) => result.status === "rejected")
    .map(([label]) => label);
}

export function formatDuration(seconds: number) {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  return `${hours}h`;
}
