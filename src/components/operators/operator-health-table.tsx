"use client";

import { useQuery } from "@tanstack/react-query";
import { RefreshCcw, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataFreshnessBadge } from "@/components/ui/data-freshness-badge";
import { ErrorState, LoadingState } from "@/components/ui/surfaces";
import { queryKeys } from "@/services/api/query";
import { loadOperatorSnapshot, statusTone, type OperatorHealthRow } from "@/services/operators";
import { normalizeUiError } from "@/services/ui-state";

export function OperatorHealthPage() {
  const {
    data: snapshot,
    error,
    isLoading,
    refetch
  } = useQuery({
    queryFn: () => loadOperatorSnapshot(),
    queryKey: queryKeys.health
  });

  if (isLoading) {
    return <LoadingState label="Loading dependency health" />;
  }

  if (snapshot === undefined) {
    const state = normalizeUiError(error, {
      code: "BACKEND_UNAVAILABLE",
      description: "Dependency readiness could not be verified against the configured backend.",
      title: "Dependency health unavailable"
    });
    return <ErrorState {...state} onRetry={() => void refetch()} />;
  }

  return (
    <>
      <PageHeader
        actions={
          <Button onClick={() => void refetch()} type="button" variant="secondary">
            <RefreshCcw aria-hidden="true" className="h-4 w-4" />
            Refresh
          </Button>
        }
        description="Read service-level health without exposing secrets, credentials, payloads, or wallet data."
        title="Operator health"
      />

      <div className="space-y-4">
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
            {snapshot.source === "api"
              ? "Live API data"
              : snapshot.source === "demo"
                ? "Explicit demo data"
                : snapshot.source === "partial"
                  ? "Partial API data"
                  : "API unavailable"}
          </Badge>
          <DataFreshnessBadge observedAt={snapshot.checkedAt} source={snapshot.source} />
          {snapshot.warnings.map((warning) => (
            <Badge key={warning} tone="neutral">
              {warning} unavailable
            </Badge>
          ))}
        </div>

        <OperatorHealthTable rows={snapshot.healthRows} />
      </div>
    </>
  );
}

export function OperatorHealthTable({ rows }: { rows: OperatorHealthRow[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Service checks</h2>
          <p className="mt-1 text-sm text-slate-600">
            API, worker, search, cache, database, RPC, and Horizon status.
          </p>
        </div>
        <ShieldCheck aria-hidden="true" className="h-5 w-5 text-teal-700" />
      </CardHeader>
      <CardBody className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Service</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Last check</th>
              <th className="px-3 py-2 font-medium">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((row) => (
              <tr className="align-top" key={row.name}>
                <td className="px-3 py-3 font-medium text-slate-950">{row.name}</td>
                <td className="px-3 py-3">
                  <Badge tone={statusTone(row.status)}>{row.status}</Badge>
                </td>
                <td className="px-3 py-3 text-slate-700">
                  {new Intl.DateTimeFormat("en", {
                    dateStyle: "medium",
                    timeStyle: "short"
                  }).format(new Date(row.checkedAt))}
                </td>
                <td className="px-3 py-3 text-slate-600">{row.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}
