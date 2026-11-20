import { ArrowRight, CheckCircle2, Clock, ShieldQuestion } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import type { Resource, Seller } from "@/services/api/schemas";
import type { DiscoveryDensity } from "@/services/settings";

import { ResourceHealthBadges } from "./resource-health";

/** Visible-field preferences for discovery result cards. */
export const discoveryResultFieldIds = [
  "seller",
  "network",
  "asset",
  "amount",
  "evidence"
] as const;

export type DiscoveryResultField = (typeof discoveryResultFieldIds)[number];

export type DiscoveryResultFieldOption = {
  id: DiscoveryResultField;
  label: string;
  required?: boolean;
};

export const discoveryResultFields: readonly DiscoveryResultFieldOption[] = [
  { id: "seller", label: "Seller", required: true },
  { id: "network", label: "Network" },
  { id: "asset", label: "Asset" },
  { id: "amount", label: "Amount" },
  { id: "evidence", label: "Trust and health badges" }
];

type ResourceCardProps = {
  compare?: {
    disabled: boolean;
    onToggle: () => void;
    selected: boolean;
  };
  density?: DiscoveryDensity;
  partialResults?: boolean;
  resource: Resource & {
    ranking?: {
      matchedTerms: string[];
      score: number;
    };
  };
  seller?: Seller;
  visibleFields?: readonly DiscoveryResultField[];
};

export function ResourceCard({
  compare,
  density = "comfortable",
  partialResults = false,
  resource,
  seller,
  visibleFields = discoveryResultFieldIds
}: ResourceCardProps) {
  const compact = density === "compact";
  const isVisible = (field: DiscoveryResultField) => visibleFields.includes(field);
  const verified = seller?.domainVerifiedAt !== null || resource.extensions.trusted === true;
  const metadataQuality =
    typeof resource.extensions.metadataQuality === "number"
      ? Math.round(resource.extensions.metadataQuality * 100)
      : null;
  const settlementStatus =
    typeof resource.extensions.recentSettlementStatus === "string"
      ? resource.extensions.recentSettlementStatus
      : "unavailable";

  return (
    <Card>
      <CardHeader
        className={cn(
          "flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between",
          compact && "gap-2 py-3"
        )}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className={cn("font-semibold text-slate-950", compact ? "text-sm" : "text-base")}>
              {resource.name}
            </h2>
            <Badge tone={resource.type === "http" ? "info" : "neutral"}>{resource.type}</Badge>
            {partialResults ? <Badge tone="warning">Partial ranking</Badge> : null}
          </div>
          <p
            className={cn(
              "text-slate-600",
              compact ? "mt-0.5 line-clamp-2 text-xs leading-5" : "mt-1 text-sm leading-6"
            )}
          >
            {resource.description}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {compare ? (
            <label className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm">
              <input
                checked={compare.selected}
                className="h-4 w-4 rounded border-slate-300 text-teal-700"
                disabled={compare.disabled && !compare.selected}
                onChange={compare.onToggle}
                type="checkbox"
              />
              Compare
            </label>
          ) : null}
          <Link
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50"
            href={`/resources/${resource.id}`}
          >
            Inspect
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>
      </CardHeader>
      <CardBody className={cn(compact ? "space-y-2 py-3" : "space-y-4")}>
        <dl
          className={cn(
            "grid gap-x-4 gap-y-1",
            compact
              ? "grid-cols-2 text-xs sm:grid-cols-4"
              : "gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4"
          )}
        >
          {isVisible("seller") ? (
            <div>
              <dt className="text-slate-500">Seller</dt>
              <dd className="mt-1 break-all font-medium text-slate-900">
                {seller?.domain ?? resource.sellerId}
              </dd>
            </div>
          ) : null}
          {isVisible("network") ? (
            <div>
              <dt className="text-slate-500">Network</dt>
              <dd className="mt-1 font-medium text-slate-900">{resource.network}</dd>
            </div>
          ) : null}
          {isVisible("asset") ? (
            <div>
              <dt className="text-slate-500">Asset</dt>
              <dd className="mt-1 font-medium text-slate-900">{resource.assetCode}</dd>
            </div>
          ) : null}
          {isVisible("amount") ? (
            <div>
              <dt className="text-slate-500">Amount</dt>
              <dd className="mt-1 font-medium text-slate-900">{resource.amount}</dd>
            </div>
          ) : null}
        </dl>

        {isVisible("evidence") ? (
          <div className="flex flex-wrap gap-2">
            <Badge tone={verified ? "success" : "warning"}>
              {verified ? (
                <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
              ) : (
                <ShieldQuestion aria-hidden="true" className="h-3.5 w-3.5" />
              )}
              {verified ? "Verified seller" : "Unverified seller"}
            </Badge>
            <Badge tone={settlementStatus === "settled" ? "success" : "neutral"}>
              <Clock aria-hidden="true" className="h-3.5 w-3.5" />
              Settlement {settlementStatus}
            </Badge>
            {metadataQuality !== null ? (
              <Badge tone={metadataQuality >= 90 ? "success" : "info"}>
                Metadata {metadataQuality}%
              </Badge>
            ) : null}
            {resource.ranking?.matchedTerms.length ? (
              <Badge tone="neutral">{resource.ranking.matchedTerms.join(", ")}</Badge>
            ) : null}
          </div>
        ) : null}

        {isVisible("evidence") ? <ResourceHealthBadges resource={resource} /> : null}
      </CardBody>
    </Card>
  );
}
