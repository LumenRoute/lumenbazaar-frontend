"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, Database, Gauge, Store, WalletCards, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { queryKeys } from "@/services/api/query";
import { formatDuration, loadDashboardSnapshot } from "@/services/dashboard";

type MetricDefinition = {
  icon: LucideIcon;
  key: "indexedResourceCount" | "activeSellerCount" | "settledPaymentCount" | "apiUptimeSeconds";
  label: string;
  transform?: (value: number) => string;
};

const metrics: MetricDefinition[] = [
  {
    icon: Database,
    key: "indexedResourceCount",
    label: "Indexed resources"
  },
  {
    icon: Store,
    key: "activeSellerCount",
    label: "Active sellers"
  },
  {
    icon: WalletCards,
    key: "settledPaymentCount",
    label: "Settled payments"
  },
  {
    icon: Gauge,
    key: "apiUptimeSeconds",
    label: "API uptime",
    transform: formatDuration
  }
] as const;

export function DashboardMetrics() {
  const { data } = useQuery({
    initialData: undefined,
    queryFn: () => loadDashboardSnapshot(),
    queryKey: queryKeys.dashboard
  });
  const snapshot = data;

  if (snapshot === undefined) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.key} className="h-36 animate-pulse bg-white" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          tone={
            snapshot.source === "api"
              ? "success"
              : snapshot.source === "partial"
                ? "warning"
                : "danger"
          }
        >
          {snapshot.source === "api"
            ? "Live API data"
            : snapshot.source === "partial"
              ? "Partial API data"
              : "API unavailable"}
        </Badge>
        {snapshot.warnings.map((warning) => (
          <Badge key={warning} tone="neutral">
            {warning} unavailable
          </Badge>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const value = snapshot.metrics[metric.key];

          return (
            <Card key={metric.key}>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <h2 className="text-sm font-medium text-slate-600">{metric.label}</h2>
                <Icon aria-hidden="true" className="h-5 w-5 text-teal-700" />
              </CardHeader>
              <CardBody>
                <p className="text-3xl font-semibold text-slate-950">
                  {value === null
                    ? "Unavailable"
                    : metric.transform
                      ? metric.transform(value)
                      : value}
                </p>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-slate-950">Settlement volume</h2>
          </CardHeader>
          <CardBody>
            {Object.entries(snapshot.metrics.settlementVolumeByNetwork).map(([network, value]) => (
              <div key={network} className="space-y-2">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="font-medium text-slate-700">{network}</span>
                  <span className="text-slate-600">{value.toFixed(2)} USDC</span>
                </div>
                <div className="h-3 overflow-hidden rounded-sm bg-slate-100">
                  <div
                    className="h-full rounded-sm bg-teal-700"
                    style={{ width: `${Math.min(Math.max(value * 100, 8), 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {Object.keys(snapshot.metrics.settlementVolumeByNetwork).length === 0 ? (
              <p className="text-sm text-slate-600">Unavailable from the current API.</p>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-950">Network and conformance</h2>
            <Activity aria-hidden="true" className="h-5 w-5 text-blue-700" />
          </CardHeader>
          <CardBody className="space-y-4">
            <div>
              <p className="text-sm font-medium text-slate-600">Supported networks</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {snapshot.metrics.supportedNetworks.map((network) => (
                  <Badge key={network} tone="info">
                    {network}
                  </Badge>
                ))}
                {snapshot.metrics.supportedNetworks.length === 0 ? (
                  <span className="text-sm text-slate-600">Unavailable</span>
                ) : null}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600">Latest conformance</p>
              <p className="mt-1 text-lg font-semibold capitalize text-slate-950">
                {snapshot.metrics.latestConformanceStatus}
              </p>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
