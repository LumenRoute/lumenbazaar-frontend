"use client";

import { useQuery } from "@tanstack/react-query";
import { Beaker, RefreshCcw } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataFreshnessBadge } from "@/components/ui/data-freshness-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/surfaces";
import { queryKeys } from "@/services/api/query";
import { conformanceEndpointStatus, loadOperatorSnapshot, statusTone } from "@/services/operators";
import { emptyStateForCollection, normalizeUiError } from "@/services/ui-state";

const endpointChecks = [
  { endpoint: "/v1/supported", label: "/supported" },
  { endpoint: "/v1/verify", label: "/verify" },
  { endpoint: "/v1/settle", label: "/settle" }
] as const;

export function ConformancePanel() {
  const {
    data: snapshot,
    error,
    isLoading,
    refetch
  } = useQuery({
    queryFn: () => loadOperatorSnapshot(),
    queryKey: queryKeys.conformance
  });

  if (isLoading) {
    return <LoadingState label="Loading conformance evidence" />;
  }

  if (snapshot === undefined) {
    const state = normalizeUiError(error, {
      code: "BACKEND_UNAVAILABLE",
      description: "Conformance evidence could not be verified against the configured backend.",
      title: "Conformance unavailable"
    });
    return <ErrorState {...state} onRetry={() => void refetch()} />;
  }

  if (snapshot.conformance === null) {
    return (
      <>
        <PageHeader
          actions={
            <Button onClick={() => void refetch()} type="button" variant="secondary">
              <RefreshCcw aria-hidden="true" className="h-4 w-4" />
              Refresh
            </Button>
          }
          description="Review facilitator conformance for supported schemes, exact verification, exact settlement, and reserved capped-session coverage."
          title="Conformance"
        />
        <ErrorState
          code="CONFORMANCE_UNAVAILABLE"
          description="No live conformance run could be verified from the configured backend."
          onRetry={() => void refetch()}
          title="Conformance unavailable"
        />
      </>
    );
  }

  const run = snapshot.conformance;
  const exactResults = run.results.filter((result) => result.scheme === "exact");
  const uptoResults = run.results.filter((result) => result.scheme === "upto");
  const emptyState = emptyStateForCollection("conformance");

  return (
    <>
      <PageHeader
        actions={
          <Button onClick={() => void refetch()} type="button" variant="secondary">
            <RefreshCcw aria-hidden="true" className="h-4 w-4" />
            Refresh
          </Button>
        }
        description="Review facilitator conformance for supported schemes, exact verification, exact settlement, and reserved capped-session coverage."
        title="Conformance"
      />

      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={snapshot.source === "api" ? "success" : "warning"}>
            {snapshot.source === "api"
              ? "Live API data"
              : snapshot.source === "demo"
                ? "Explicit demo data"
                : "Partial API data"}
          </Badge>
          <DataFreshnessBadge observedAt={snapshot.checkedAt} source={snapshot.source} />
          {snapshot.warnings.map((warning) => (
            <Badge key={warning} tone="neutral">
              {warning} unavailable
            </Badge>
          ))}
        </div>

        {run.results.length === 0 ? (
          <EmptyState title={emptyState.title} description={emptyState.description} />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SummaryCard label="Run status" tone={statusTone(run.status)} value={run.status} />
              <SummaryCard
                label="Exact checks"
                tone="success"
                value={String(exactResults.length)}
              />
              <SummaryCard label="Reserved upto" tone="warning" value={String(run.reservedCount)} />
              <SummaryCard label="Network" tone="info" value={run.network} />
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Endpoint checks</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Core exact x402 endpoints and advertised scheme coverage.
                  </p>
                </div>
                <Beaker aria-hidden="true" className="h-5 w-5 text-teal-700" />
              </CardHeader>
              <CardBody className="grid gap-3 md:grid-cols-3">
                {endpointChecks.map((check) => {
                  const status = conformanceEndpointStatus(run, check.endpoint);

                  return (
                    <div className="rounded-md border border-slate-200 p-4" key={check.endpoint}>
                      <p className="font-medium text-slate-950">{check.label}</p>
                      <Badge
                        className="mt-3"
                        tone={statusTone(status === "missing" ? "down" : status)}
                      >
                        {status}
                      </Badge>
                    </div>
                  );
                })}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-slate-950">Scheme coverage</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Exact checks are active today; `upto` checks remain visible as reserved readiness
                  slots.
                </p>
              </CardHeader>
              <CardBody className="grid gap-4 lg:grid-cols-2">
                <CoverageBlock results={exactResults} title="Exact payments" />
                <CoverageBlock results={uptoResults} title="Capped upto sessions" />
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-slate-950">Latest run</h2>
                <p className="mt-1 break-all text-sm text-slate-600">{run.id}</p>
              </CardHeader>
              <CardBody className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Check</th>
                      <th className="px-3 py-2 font-medium">Endpoint</th>
                      <th className="px-3 py-2 font-medium">Scheme</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Duration</th>
                      <th className="px-3 py-2 font-medium">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {run.results.map((result) => (
                      <tr className="align-top" key={result.id}>
                        <td className="px-3 py-3">
                          <p className="font-medium text-slate-950">{result.name}</p>
                          <p className="mt-1 text-xs text-slate-500">{result.id}</p>
                        </td>
                        <td className="px-3 py-3 text-slate-700">
                          {result.method} {result.endpoint}
                        </td>
                        <td className="px-3 py-3">
                          <Badge tone={result.scheme === "exact" ? "success" : "warning"}>
                            {result.scheme}
                          </Badge>
                        </td>
                        <td className="px-3 py-3">
                          <Badge tone={statusTone(result.status)}>{result.status}</Badge>
                        </td>
                        <td className="px-3 py-3 text-slate-700">{result.durationMs}ms</td>
                        <td className="px-3 py-3 text-slate-600">
                          {result.error ?? result.description ?? "No additional detail"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardBody>
            </Card>
          </>
        )}
      </div>
    </>
  );
}

function SummaryCard({
  label,
  tone,
  value
}: {
  label: string;
  tone: "danger" | "info" | "neutral" | "success" | "warning";
  value: string;
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-medium text-slate-600">{label}</h2>
      </CardHeader>
      <CardBody>
        <p className="break-words text-2xl font-semibold text-slate-950">{value}</p>
        <Badge className="mt-3" tone={tone}>
          {label}
        </Badge>
      </CardBody>
    </Card>
  );
}

function CoverageBlock({
  results,
  title
}: {
  results: Array<{
    id: string;
    name: string;
    status: "failed" | "passed" | "reserved";
  }>;
  title: string;
}) {
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <h3 className="font-medium text-slate-950">{title}</h3>
      <div className="mt-3 space-y-2">
        {results.map((result) => (
          <div className="flex flex-wrap items-center justify-between gap-3" key={result.id}>
            <span className="text-sm text-slate-700">{result.name}</span>
            <Badge tone={statusTone(result.status)}>{result.status}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
