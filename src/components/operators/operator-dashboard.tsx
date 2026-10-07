"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  CheckCircle2,
  Database,
  ExternalLink,
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
import { DataFreshnessBadge } from "@/components/ui/data-freshness-badge";
import { ErrorState, LoadingState } from "@/components/ui/surfaces";
import { loadRuntimeConfig } from "@/config/runtime";
import { queryKeys } from "@/services/api/query";
import { loadOperatorSnapshot, statusTone } from "@/services/operators";
import { normalizeUiError } from "@/services/ui-state";

export function OperatorDashboard() {
  const {
    data: snapshot,
    error,
    isLoading,
    refetch
  } = useQuery({
    queryFn: () => loadOperatorSnapshot(),
    queryKey: queryKeys.operators
  });

  if (isLoading) {
    return <LoadingState label="Loading operator status" />;
  }

  if (snapshot === undefined) {
    const state = normalizeUiError(error, {
      code: "BACKEND_UNAVAILABLE",
      description: "Operator state could not be verified against the configured backend.",
      title: "Operator state unavailable"
    });
    return <ErrorState {...state} onRetry={() => void refetch()} />;
  }

  const apiStatus = snapshot.healthRows.find((row) => row.name === "API");
  const rpcStatus = snapshot.healthRows.find((row) => row.name === "RPC");
  const horizonStatus = snapshot.healthRows.find((row) => row.name === "Horizon");
  const settlementQueueDepth = snapshot.metrics.queueDepth["settlement-confirmation"] ?? null;
  const config = loadRuntimeConfig();

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
          <Badge
            tone={
              snapshot.source === "api"
                ? "success"
                : snapshot.source === "unavailable"
                  ? "danger"
                  : "warning"
            }
          >
            {sourceLabel(snapshot.source)}
          </Badge>
          <DataFreshnessBadge observedAt={snapshot.checkedAt} source={snapshot.source} />
          {snapshot.warnings.map((warning) => (
            <Badge key={warning} tone="neutral">
              {warning} unavailable
            </Badge>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatusMetric
            icon={Activity}
            label="API"
            status={apiStatus?.status ?? "unknown"}
            value={apiStatus?.status ?? "unknown"}
          />
          <StatusMetric
            icon={Database}
            label="Queue depth"
            status={
              settlementQueueDepth === null
                ? "unknown"
                : settlementQueueDepth > 5
                  ? "degraded"
                  : "operational"
            }
            value={String(settlementQueueDepth ?? "unknown")}
          />
          <StatusMetric
            icon={Gauge}
            label="Settlement p95"
            status={
              snapshot.metrics.settlementLatencyP95Ms === null
                ? "unknown"
                : snapshot.metrics.settlementLatencyP95Ms > 1_500
                  ? "degraded"
                  : "operational"
            }
            value={
              snapshot.metrics.settlementLatencyP95Ms === null
                ? "unknown"
                : `${snapshot.metrics.settlementLatencyP95Ms}ms`
            }
          />
          <StatusMetric
            icon={CheckCircle2}
            label="Success rate"
            status={
              snapshot.metrics.settlementSuccessRate === null
                ? "unknown"
                : snapshot.metrics.settlementSuccessRate < 0.9
                  ? "degraded"
                  : "operational"
            }
            value={
              snapshot.metrics.settlementSuccessRate === null
                ? "unknown"
                : `${Math.round(snapshot.metrics.settlementSuccessRate * 100)}%`
            }
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
              {snapshot.supported.kinds.map((kind) => (
                <div
                  key={`${kind.network}-${kind.scheme}`}
                  className="rounded-md border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-950">{kind.network}</p>
                      <p className="mt-1 text-sm text-slate-600">{kind.scheme} payments</p>
                    </div>
                    <Badge tone={kind.scheme === "exact" ? "success" : "warning"}>
                      {kind.scheme}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(kind.extra?.assets ?? []).map((asset) => (
                      <Badge key={`${kind.network}-${kind.scheme}-${asset.code}`} tone="info">
                        {asset.code} / {asset.decimals} decimals
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
              {snapshot.supported.kinds.length === 0 ? (
                <p className="text-sm text-slate-600">Supported schemes are unavailable.</p>
              ) : null}
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

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-950">Release evidence</h2>
            <p className="mt-1 text-sm text-slate-600">
              Backend identity and reviewer-verifiable source artifacts.
            </p>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge tone={snapshot.version === null ? "warning" : "info"}>
                API {snapshot.version?.version ?? "unknown"}
              </Badge>
              <Badge tone="neutral">Commit {snapshot.version?.commit ?? "unknown"}</Badge>
              <Badge tone="neutral">Conformance {snapshot.conformance?.id ?? "unavailable"}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <EvidenceLink href={config.apiBaseUrl} label="Backend" />
              <EvidenceLink href={`${config.apiBaseUrl}/openapi.json`} label="OpenAPI" />
              <EvidenceLink
                href="https://github.com/LumenRoute/lumenbazaar-backend"
                label="Backend source"
              />
              <EvidenceLink
                href="https://github.com/LumenRoute/lumenbazaar-contracts"
                label="Contracts"
              />
              <EvidenceLink
                href="https://github.com/LumenRoute/lumenbazaar-docs"
                label="Documentation"
              />
              {snapshot.version?.commit !== undefined ? (
                <EvidenceLink
                  href={`https://github.com/LumenRoute/lumenbazaar-backend/commit/${snapshot.version.commit}`}
                  label="Release commit"
                />
              ) : null}
            </div>
          </CardBody>
        </Card>
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
  status: "operational" | "degraded" | "down" | "unknown";
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

function EvidenceLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      <ExternalLink aria-hidden="true" className="h-4 w-4" />
      {label}
    </a>
  );
}

function sourceLabel(source: "api" | "demo" | "partial" | "unavailable") {
  if (source === "api") return "Live API data";
  if (source === "demo") return "Explicit demo data";
  if (source === "partial") return "Partial API data";
  return "API unavailable";
}
