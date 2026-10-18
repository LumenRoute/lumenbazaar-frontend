"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataFreshnessBadge } from "@/components/ui/data-freshness-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/surfaces";
import { queryKeys } from "@/services/api/query";
import {
  loadResourceComparison,
  type ComparisonRow,
  type ResourceComparison as ResourceComparisonSnapshot
} from "@/services/resource-comparison";
import { normalizeUiError } from "@/services/ui-state";

export function ResourceComparison({ resourceIds }: { resourceIds: string[] }) {
  const { data, error, isLoading, refetch } = useQuery({
    queryFn: () => loadResourceComparison(resourceIds),
    queryKey: queryKeys.comparison(resourceIds)
  });

  if (isLoading) {
    return <LoadingState label="Loading resource comparison" />;
  }

  if (data === undefined || error !== null) {
    return (
      <ErrorState
        {...normalizeUiError(error, {
          code: "BACKEND_UNAVAILABLE",
          description: "The selected resources could not be compared against the live catalog.",
          title: "Comparison unavailable"
        })}
        onRetry={() => void refetch()}
      />
    );
  }

  if (data.columns.length < 2) {
    return (
      <EmptyState
        description="Select at least two resources from the explore results to compare their payment terms, schemas, seller evidence, and freshness."
        title="Select resources to compare"
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        description="Compare payment terms, schemas, seller verification, and freshness side by side. Unknown values are shown explicitly and no aggregate score is used."
        title="Compare resources"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={data.source === "api" ? "success" : "warning"}>
          {data.source === "api" ? "Live API records" : "Explicit demo records"}
        </Badge>
        <DataFreshnessBadge observedAt={data.fetchedAt} source={data.source} />
        <Badge tone="neutral">{data.columns.length} of 4 selected</Badge>
        <Link className="text-sm font-medium text-teal-700 underline" href="/explore">
          Back to explore
        </Link>
      </div>

      <ComparisonWarnings comparison={data} />

      <div className="grid gap-4 lg:hidden" data-testid="comparison-mobile">
        {data.columns.map((column, index) => (
          <Card key={column.id}>
            <CardHeader>
              <h2 className="break-words text-base font-semibold text-slate-950">{column.name}</h2>
              <p className="mt-1 break-all text-xs text-slate-500">{column.id}</p>
            </CardHeader>
            <CardBody>
              <dl className="space-y-3 text-sm">
                {data.rows.map((row) => (
                  <div key={row.key}>
                    <dt className="text-slate-500">{row.label}</dt>
                    <dd className="mt-0.5 break-all font-medium text-slate-900">
                      <ComparisonValue value={row.values[index] ?? null} />
                    </dd>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card className="hidden lg:block">
        <CardBody className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-left text-sm">
            <caption className="sr-only">Paid resource comparison</caption>
            <thead>
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3 text-xs font-medium uppercase text-slate-500">Field</th>
                {data.columns.map((column) => (
                  <th className="px-4 py-3 align-top" key={column.id} scope="col">
                    <span className="block break-words font-semibold text-slate-950">
                      {column.name}
                    </span>
                    <span className="mt-1 block break-all text-xs font-normal text-slate-500">
                      {column.id}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.rows.map((row) => (
                <tr
                  className={row.prominent && rowDiffers(row) ? "bg-amber-50" : undefined}
                  key={row.key}
                >
                  <th
                    className="px-4 py-3 align-top text-xs font-medium uppercase text-slate-500"
                    scope="row"
                  >
                    {row.label}
                    {row.prominent ? (
                      <span className="sr-only"> (important difference)</span>
                    ) : null}
                  </th>
                  {row.values.map((value, index) => (
                    <td
                      className="px-4 py-3 align-top break-all text-slate-900"
                      key={`${row.key}-${data.columns[index]?.id ?? index}`}
                    >
                      <ComparisonValue value={value} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      {data.unavailableIds.length > 0 ? (
        <p className="text-sm text-amber-800">
          Some selected resources could not be loaded: {data.unavailableIds.join(", ")}.
        </p>
      ) : null}
      <p className="text-xs leading-5 text-slate-500">
        {data.unknownFieldCount} field{data.unknownFieldCount === 1 ? "" : "s"} could not be
        verified from backend evidence. Unknown values are never assumed to be safe or healthy.
      </p>
    </div>
  );
}

function ComparisonWarnings({ comparison }: { comparison: ResourceComparisonSnapshot }) {
  const warnings: string[] = [];

  if (comparison.networkMismatch) {
    warnings.push("Selected resources settle on different Stellar networks.");
  }

  if (comparison.assetContractMismatch) {
    warnings.push("Selected resources use different asset contracts.");
  }

  if (comparison.schemaMismatch) {
    warnings.push(
      "Request or response schemas are incompatible, so integrations cannot be swapped directly."
    );
  }

  if (warnings.length === 0) return null;

  return (
    <div className="space-y-2" role="alert">
      {warnings.map((warning) => (
        <p
          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900"
          key={warning}
        >
          {warning}
        </p>
      ))}
    </div>
  );
}

function ComparisonValue({ value }: { value: string | null }) {
  if (value === null) {
    return <span className="font-normal italic text-slate-500">Unknown</span>;
  }

  return <>{value}</>;
}

function rowDiffers(row: ComparisonRow) {
  const known = row.values.filter((value): value is string => value !== null);

  return known.length > 1 && new Set(known).size > 1;
}
