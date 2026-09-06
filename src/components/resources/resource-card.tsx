import { ArrowRight, CheckCircle2, Clock, ShieldQuestion } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { Resource, Seller } from "@/services/api/schemas";

type ResourceCardProps = {
  partialResults?: boolean;
  resource: Resource & {
    ranking?: {
      matchedTerms: string[];
      score: number;
    };
  };
  seller?: Seller;
};

export function ResourceCard({ partialResults = false, resource, seller }: ResourceCardProps) {
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
      <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-slate-950">{resource.name}</h2>
            <Badge tone={resource.type === "http" ? "info" : "neutral"}>{resource.type}</Badge>
            {partialResults ? <Badge tone="warning">Partial ranking</Badge> : null}
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-600">{resource.description}</p>
        </div>
        <Link
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50"
          href={`/resources/${resource.id}`}
        >
          Inspect
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </CardHeader>
      <CardBody className="space-y-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <dt className="text-slate-500">Seller</dt>
            <dd className="mt-1 break-all font-medium text-slate-900">
              {seller?.domain ?? resource.sellerId}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Network</dt>
            <dd className="mt-1 font-medium text-slate-900">{resource.network}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Asset</dt>
            <dd className="mt-1 font-medium text-slate-900">{resource.assetCode}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Amount</dt>
            <dd className="mt-1 font-medium text-slate-900">{resource.amount}</dd>
          </div>
        </dl>

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
      </CardBody>
    </Card>
  );
}
