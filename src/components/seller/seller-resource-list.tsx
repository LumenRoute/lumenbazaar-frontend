"use client";

import { useQuery } from "@tanstack/react-query";
import { Ban, Eye, Pencil, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataFreshnessBadge } from "@/components/ui/data-freshness-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/surfaces";
import { isDemoMode, loadRuntimeConfig } from "@/config/runtime";
import type { Resource, ResourceStatus } from "@/services/api/schemas";
import { queryKeys } from "@/services/api/query";
import { formatPaymentAmount, loadSellerResourceSnapshot, shortHash } from "@/services/payments";
import { emptyStateForCollection, normalizeUiError } from "@/services/ui-state";

const statusOptions: Array<{ label: string; value: ResourceStatus | "all" }> = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Draft", value: "draft" },
  { label: "Inactive", value: "inactive" }
];

export function SellerResourceList({ sellerId = "seller_atlas_weather" }: { sellerId?: string }) {
  const mode = loadRuntimeConfig().environment;
  const demo = isDemoMode(mode);
  const [status, setStatus] = useState<ResourceStatus | "all">("all");
  const [disabledIds, setDisabledIds] = useState<Set<string>>(new Set());
  const emptyState = emptyStateForCollection("resources");
  const { data, error, isLoading, refetch } = useQuery({
    queryFn: () =>
      loadSellerResourceSnapshot(
        { sellerId, ...(status === "all" ? {} : { status }) },
        undefined,
        mode
      ),
    queryKey: queryKeys.resources({ mode, sellerId, status })
  });
  const resources = (data?.resources ?? []).map((resource) =>
    disabledIds.has(resource.id)
      ? {
          ...resource,
          status: "inactive" as const
        }
      : resource
  );

  if (isLoading) return <LoadingState label="Loading seller resources" />;

  return (
    <>
      <PageHeader
        actions={
          <Link
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-teal-700 bg-teal-700 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-800"
            href="/seller/new-resource"
          >
            New resource
          </Link>
        }
        description="Manage draft, active, and inactive paid resources owned by the current seller."
        title="Seller resources"
      />

      <div className="space-y-4">
        {data === undefined ? (
          <ErrorState
            {...normalizeUiError(error, {
              code: "BACKEND_UNAVAILABLE",
              description: "Seller resources could not be verified against the configured backend.",
              title: "Seller resources unavailable"
            })}
            onRetry={() => void refetch()}
          />
        ) : null}
        {data !== undefined ? (
          <Card>
            <CardBody className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="break-all text-sm font-medium text-slate-950">{sellerId}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge tone={data.source === "api" ? "success" : "warning"}>
                    {data.source === "api" ? "Live API data" : "Explicit demo data"}
                  </Badge>
                  <DataFreshnessBadge observedAt={data.fetchedAt} source={data.source} />
                </div>
              </div>
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="Filter resource status"
              >
                {statusOptions.map((option) => (
                  <Button
                    key={option.value}
                    className="min-w-20"
                    onClick={() => setStatus(option.value)}
                    type="button"
                    variant={status === option.value ? "primary" : "secondary"}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </CardBody>
          </Card>
        ) : null}

        {data !== undefined ? (
          resources.length === 0 ? (
            <EmptyState title={emptyState.title} description={emptyState.description} />
          ) : (
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-slate-950">Resource inventory</h2>
              </CardHeader>
              <CardBody className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Resource</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Network</th>
                      <th className="px-3 py-2 font-medium">Price</th>
                      <th className="px-3 py-2 font-medium">Last indexed</th>
                      <th className="px-3 py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {resources.map((resource) => (
                      <ResourceRow
                        disabled={disabledIds.has(resource.id)}
                        editable={demo}
                        key={resource.id}
                        onDisable={() =>
                          setDisabledIds((current) => new Set([...current, resource.id]))
                        }
                        onRestore={() =>
                          setDisabledIds((current) => {
                            const next = new Set(current);
                            next.delete(resource.id);
                            return next;
                          })
                        }
                        resource={resource}
                      />
                    ))}
                  </tbody>
                </table>
              </CardBody>
            </Card>
          )
        ) : null}
      </div>
    </>
  );
}

function ResourceRow({
  disabled,
  editable,
  onDisable,
  onRestore,
  resource
}: {
  disabled: boolean;
  editable: boolean;
  onDisable: () => void;
  onRestore: () => void;
  resource: Resource;
}) {
  return (
    <tr className="align-top">
      <td className="px-3 py-3">
        <div className="max-w-xs">
          <p className="font-medium text-slate-950">{resource.name}</p>
          <p className="mt-1 break-all text-xs text-slate-500">{resource.routeTemplate}</p>
        </div>
      </td>
      <td className="px-3 py-3">
        <Badge tone={statusTone(resource.status)}>{resource.status}</Badge>
      </td>
      <td className="px-3 py-3 text-slate-700">{resource.network}</td>
      <td className="px-3 py-3 text-slate-700">
        <span className="block">{formatPaymentAmount(resource.amount, resource.assetCode)}</span>
        <span className="block break-all text-xs text-slate-500">
          {shortHash(resource.assetIssuer)}
        </span>
      </td>
      <td className="px-3 py-3 text-slate-700">
        {new Intl.DateTimeFormat("en", {
          dateStyle: "medium",
          timeStyle: "short"
        }).format(new Date(resource.updatedAt))}
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap gap-2">
          <Link
            aria-label={`View ${resource.name}`}
            className="inline-flex min-h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-slate-700 hover:bg-slate-50"
            href={`/resources/${resource.id}`}
            title="View resource"
          >
            <Eye aria-hidden="true" className="h-4 w-4" />
          </Link>
          {editable ? (
            <Link
              aria-label={`Edit ${resource.name}`}
              className="inline-flex min-h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-slate-700 hover:bg-slate-50"
              href={`/seller/new-resource?resourceId=${resource.id}`}
              title="Edit resource"
            >
              <Pencil aria-hidden="true" className="h-4 w-4" />
            </Link>
          ) : null}
          {editable &&
            (disabled ? (
              <Button
                aria-label={`Restore ${resource.name}`}
                className="min-h-9 px-2"
                onClick={onRestore}
                title="Restore resource"
                type="button"
                variant="secondary"
              >
                <RotateCcw aria-hidden="true" className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                aria-label={`Disable ${resource.name}`}
                className="min-h-9 px-2"
                onClick={onDisable}
                title="Disable resource"
                type="button"
                variant="danger"
              >
                <Ban aria-hidden="true" className="h-4 w-4" />
              </Button>
            ))}
        </div>
      </td>
    </tr>
  );
}

function statusTone(status: ResourceStatus) {
  if (status === "active") {
    return "success";
  }

  if (status === "draft") {
    return "warning";
  }

  return "neutral";
}
