import { apiClient, type LumenBazaarApiClient } from "@/services/api/client";

import { demoConformanceRun, demoDashboardMetrics, demoResources } from "@/fixtures/lumenbazaar";

export type DashboardMetrics = typeof demoDashboardMetrics;

export type DashboardSnapshot = {
  metrics: DashboardMetrics;
  source: "api" | "demo";
  warnings: string[];
};

type DashboardClient = Pick<
  LumenBazaarApiClient,
  "getHealth" | "getLatestConformanceRun" | "getNetworks" | "listResources"
>;

export async function loadDashboardSnapshot(
  client: DashboardClient = apiClient
): Promise<DashboardSnapshot> {
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
  const resources =
    resourcesResult.status === "fulfilled" ? resourcesResult.value.resources : demoResources;
  const networks =
    networksResult.status === "fulfilled"
      ? networksResult.value.networks.map((network) => network.id)
      : demoDashboardMetrics.supportedNetworks;
  const conformance =
    conformanceResult.status === "fulfilled" ? conformanceResult.value : demoConformanceRun;

  return {
    metrics: {
      ...demoDashboardMetrics,
      apiUptimeSeconds:
        healthResult.status === "fulfilled"
          ? demoDashboardMetrics.apiUptimeSeconds
          : demoDashboardMetrics.apiUptimeSeconds,
      indexedResourceCount: resources.length,
      latestConformanceStatus: conformance.status,
      supportedNetworks: networks
    },
    source: warnings.length === 4 ? "demo" : "api",
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
