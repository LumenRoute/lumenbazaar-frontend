"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  ResourceLifecycleError,
  resourceLifecycleCoordinator,
  type ResourceLifecycleAction
} from "@/services/resource-lifecycle";
import { emptyStateForCollection, normalizeUiError } from "@/services/ui-state";

const statusOptions: Array<{ label: string; value: ResourceStatus | "all" }> = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Draft", value: "draft" },
  { label: "Inactive", value: "inactive" }
];

type LifecycleDialog = {
  action: ResourceLifecycleAction;
  resource: Resource;
};

export function SellerResourceList({ sellerId = "seller_atlas_weather" }: { sellerId?: string }) {
  const mode = loadRuntimeConfig().environment;
  const demo = isDemoMode(mode);
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ResourceStatus | "all">("all");
  const [dialog, setDialog] = useState<LifecycleDialog | null>(null);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [ineligibleIds, setIneligibleIds] = useState<Set<string>>(new Set());
  const emptyState = emptyStateForCollection("resources");
  const filters = { mode, sellerId, status };
  const {
    data,
    error: queryError,
    isLoading,
    refetch
  } = useQuery({
    queryFn: () =>
      loadSellerResourceSnapshot(
        { sellerId, ...(status === "all" ? {} : { status }) },
        undefined,
        mode
      ),
    queryKey: queryKeys.resources(filters)
  });
  const resources = data?.resources ?? [];

  if (isLoading) return <LoadingState label="Loading seller resources" />;

  function openDialog(action: ResourceLifecycleAction, resource: Resource) {
    setDialog({ action, resource });
    setReason("");
    setConfirmed(false);
    setError(null);
    setNotice(null);
  }

  function closeDialog() {
    if (pendingId !== null) return;
    setDialog(null);
    setError(null);
  }

  async function submitMutation() {
    if (dialog === null) return;
    setPendingId(dialog.resource.id);
    setError(null);
    try {
      const input = {
        confirmation: confirmed,
        mode,
        reason,
        resource: dialog.resource
      };
      const outcome =
        dialog.action === "disable"
          ? await resourceLifecycleCoordinator.disable(input)
          : await resourceLifecycleCoordinator.restore(input);

      // Only mutate the visible list after the accepted result is applied by a
      // refetch; no optimistic status change is shown.
      setDialog(null);
      setNotice(
        `${outcome.resource.name} was ${
          outcome.action === "disable" ? "removed from discovery" : "restored to discovery"
        }.`
      );
      await queryClient.invalidateQueries({ queryKey: queryKeys.resources(filters) });
      await refetch();
    } catch (caught) {
      const lifecycleError =
        caught instanceof ResourceLifecycleError
          ? caught
          : new ResourceLifecycleError({
              code: "BACKEND_UNAVAILABLE",
              message: caught instanceof Error ? caught.message : "The change was not confirmed."
            });

      setError({ code: lifecycleError.code, message: lifecycleError.message });

      if (lifecycleError.code === "RESTORE_INELIGIBLE") {
        setIneligibleIds((current) => new Set([...current, dialog.resource.id]));
      }
      if (lifecycleError.code === "RESOURCE_CONFLICT") {
        setDialog(null);
        setNotice("This list was out of date. It has been refreshed; review the change again.");
        await queryClient.invalidateQueries({ queryKey: queryKeys.resources(filters) });
        await refetch();
      }
    } finally {
      setPendingId(null);
    }
  }

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
        {notice !== null ? (
          <div
            className="rounded-md border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900"
            role="status"
          >
            {notice}
          </div>
        ) : null}
        {data === undefined ? (
          <ErrorState
            {...normalizeUiError(queryError, {
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
                        editable={demo}
                        key={resource.id}
                        onDisable={() => openDialog("disable", resource)}
                        onRestore={() => openDialog("restore", resource)}
                        pending={pendingId === resource.id}
                        resource={resource}
                        restoreBlocked={ineligibleIds.has(resource.id)}
                      />
                    ))}
                  </tbody>
                </table>
              </CardBody>
            </Card>
          )
        ) : null}
      </div>

      {dialog !== null ? (
        <div
          aria-label={
            dialog.action === "disable" ? "Confirm resource disable" : "Confirm resource restore"
          }
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 sm:items-center"
          role="dialog"
        >
          <Card className="w-full max-w-lg">
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-950">
                {dialog.action === "disable" ? "Remove from discovery" : "Restore to discovery"}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {dialog.resource.name} · version {dialog.resource.updatedAt}
              </p>
            </CardHeader>
            <CardBody className="space-y-4">
              {dialog.action === "disable" ? (
                <>
                  <p className="text-sm text-slate-700">
                    Buyers will no longer discover this resource. Already issued payment
                    authorizations are not revoked by this change.
                  </p>
                  <label className="block space-y-1">
                    <span className="text-sm font-medium text-slate-700">Reason</span>
                    <textarea
                      className="min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                      onChange={(event) => setReason(event.target.value)}
                      value={reason}
                    />
                  </label>
                </>
              ) : (
                <p className="text-sm text-slate-700">
                  Restoring makes an eligible inactive version discoverable again. The backend must
                  accept eligibility before the list changes.
                </p>
              )}

              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  checked={confirmed}
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                  onChange={(event) => setConfirmed(event.target.checked)}
                  type="checkbox"
                />
                <span>
                  I understand this change applies to the current resource version and cannot be
                  undone by refreshing.
                </span>
              </label>

              {error !== null ? (
                <div
                  className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                  role="alert"
                >
                  <p className="font-medium">{error.code}</p>
                  <p className="mt-1">{error.message}</p>
                </div>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  disabled={pendingId !== null}
                  onClick={closeDialog}
                  type="button"
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  disabled={
                    pendingId !== null ||
                    !confirmed ||
                    (dialog.action === "disable" && reason.trim().length === 0)
                  }
                  onClick={() => void submitMutation()}
                  type="button"
                  variant={dialog.action === "disable" ? "danger" : "primary"}
                >
                  {pendingId !== null
                    ? "Submitting"
                    : dialog.action === "disable"
                      ? "Disable discovery"
                      : "Restore resource"}
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      ) : null}
    </>
  );
}

function ResourceRow({
  editable,
  onDisable,
  onRestore,
  pending,
  resource,
  restoreBlocked
}: {
  editable: boolean;
  onDisable: () => void;
  onRestore: () => void;
  pending: boolean;
  resource: Resource;
  restoreBlocked: boolean;
}) {
  const inactive = resource.status === "inactive";

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
            (inactive ? (
              <Button
                aria-label={`Restore ${resource.name}`}
                className="min-h-9 px-2"
                disabled={pending || restoreBlocked}
                onClick={onRestore}
                title={
                  restoreBlocked
                    ? "The backend rejected restore eligibility for this resource"
                    : "Restore resource"
                }
                type="button"
                variant="secondary"
              >
                <RotateCcw aria-hidden="true" className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                aria-label={`Disable ${resource.name}`}
                className="min-h-9 px-2"
                disabled={pending}
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
