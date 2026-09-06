"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  CheckCircle2,
  Database,
  Gauge,
  Network,
  RefreshCcw,
  type LucideIcon
} from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/surfaces";
import { queryKeys } from "@/services/api/query";
import { loadOperatorSnapshot, statusTone } from "@/services/operators";

export function OperatorDashboard() {
  const {
    data: snapshot,
    isLoading,
    refetch
  } = useQuery({
    queryFn: () => loadOperatorSnapshot(),
    queryKey: queryKeys.operators
  });

  if (isLoading || snapshot === undefined) {
    return <LoadingState label="Loading operator status" />;
  }

  const apiStatus = snapshot.healthRows.find((row) => row.name === "API");
  const rpcStatus = snapshot.healthRows.find((row) => row.name === "RPC");
  const horizonStatus = snapshot.healthRows.find((row) => row.name === "Horizon");

  return (
    <>
      <PageHeader
        actions={
          <Button onClick={() => void refetch()} type="button" variant="secondary">
            <RefreshCcw aria-hidden="true" className="h-4 w-4" />
            Refresh
          </Button>
        }
        description="Monitor facilitator status, supported Stellar networks, configured assets, settlement queues, and external dependencies."
        title="Operator dashboard"
      />

      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={snapshot.source === "api" ? "success" : "warning"}>
            {snapshot.source === "api" ? "API data" : "Local demo data"}
          </Badge>
          {snapshot.warnings.map((warning) => (
            <Badge key={warning} tone="neutral">
              {warning} fallback
            </Badge>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatusMetric
            icon={Activity}
            label="API"
            status={apiStatus?.status ?? "degraded"}
            value={apiStatus?.status ?? "unknown"}
          />
          <StatusMetric
            icon={Database}
            label="Queue depth"
            status={
              snapshot.metrics.queueDepth["settlement-confirmation"] > 5
                ? "degraded"
                : "operational"
            }
            value={String(snapshot.metrics.queueDepth["settlement-confirmation"])}
          />
          <StatusMetric
            icon={Gauge}
            label="Settlement p95"
            status={snapshot.metrics.settlementLatencyP95Ms > 1_500 ? "degraded" : "operational"}
            value={`${snapshot.metrics.settlementLatencyP95Ms}ms`}
          />
          <StatusMetric
            icon={CheckCircle2}
            label="Success rate"
            status={snapshot.metrics.settlementSuccessRate < 0.9 ? "degraded" : "operational"}
            value={`${Math.round(snapshot.metrics.settlementSuccessRate * 100)}%`}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Supported networks</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Assets and schemes advertised by `/v1/supported`.
                </p>
              </div>
              <Network aria-hidden="true" className="h-5 w-5 text-blue-700" />
            </CardHeader>
            <CardBody className="space-y-4">
              {snapshot.supported.schemes.map((scheme) => (
                <div
                  key={`${scheme.network}-${scheme.name}`}
                  className="rounded-md border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-950">{scheme.network}</p>
                      <p className="mt-1 text-sm text-slate-600">{scheme.name} payments</p>
                    </div>
                    <Badge tone={scheme.name === "exact" ? "success" : "warning"}>
                      {scheme.name}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {scheme.assets.map((asset) => (
                      <Badge key={`${scheme.network}-${scheme.name}-${asset.code}`} tone="info">
                        {asset.code} / {asset.decimals} decimals
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-950">Dependency health</h2>
              <p className="mt-1 text-sm text-slate-600">
                RPC, Horizon, worker, database, Redis, and search status.
              </p>
            </CardHeader>
            <CardBody className="space-y-3">
              {[apiStatus, rpcStatus, horizonStatus]
                .filter((row): row is NonNullable<typeof row> => row !== undefined)
                .map((row) => (
                  <div
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2"
                    key={row.name}
                  >
                    <div>
                      <p className="font-medium text-slate-950">{row.name}</p>
                      <p className="mt-1 text-xs text-slate-600">{row.detail}</p>
                    </div>
                    <Badge tone={statusTone(row.status)}>{row.status}</Badge>
                  </div>
                ))}
              <Link
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                href="/operators/health"
              >
                Full health table
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function StatusMetric({
  icon: Icon,
  label,
  status,
  value
}: {
  icon: LucideIcon;
  label: string;
  status: "operational" | "degraded" | "down";
  value: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-slate-600">{label}</h2>
        <Icon aria-hidden="true" className="h-5 w-5 text-teal-700" />
      </CardHeader>
      <CardBody>
        <p className="break-words text-2xl font-semibold capitalize text-slate-950">{value}</p>
        <Badge className="mt-3" tone={statusTone(status)}>
          {status}
        </Badge>
      </CardBody>
    </Card>
  );
}
