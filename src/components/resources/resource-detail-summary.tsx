import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { Receipt, Resource, Seller } from "@/services/api/schemas";

type ResourceDetailSummaryProps = {
  receipts: Receipt[];
  resource: Resource;
  seller?: Seller;
  source: "api" | "demo";
};

export function ResourceDetailSummary({
  receipts,
  resource,
  seller,
  source
}: ResourceDetailSummaryProps) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <Badge tone={source === "api" ? "success" : "warning"}>
          {source === "api" ? "API data" : "Demo data"}
        </Badge>
        <Badge tone={resource.status === "active" ? "success" : "neutral"}>{resource.status}</Badge>
        <Badge tone={resource.type === "http" ? "info" : "neutral"}>{resource.type}</Badge>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-950">{resource.name}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{resource.description}</p>
        </CardHeader>
        <CardBody className="grid gap-4 text-sm md:grid-cols-2 xl:grid-cols-3">
          <Field label="Seller" value={seller?.domain ?? resource.sellerId} />
          <Field label="Endpoint URL" value={resource.url} wrap />
          <Field label="Route template" value={resource.routeTemplate} wrap />
          <Field label="Network" value={resource.network} />
          <Field label="Pay to" value={resource.payTo} wrap />
          <Field label="Status" value={resource.status} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-950">Payment terms</h2>
        </CardHeader>
        <CardBody className="grid gap-4 text-sm md:grid-cols-2 xl:grid-cols-4">
          <Field label="Scheme" value="exact" />
          <Field label="Asset" value={`${resource.assetCode}:${resource.assetIssuer}`} wrap />
          <Field label="Amount" value={resource.amount} />
          <Field label="Recipient" value={resource.payTo} wrap />
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-950">Public settlement history</h2>
          <Badge tone={receipts.length > 0 ? "success" : "neutral"}>
            {receipts.length} receipts
          </Badge>
        </CardHeader>
        <CardBody className="space-y-3">
          {receipts.length === 0 ? (
            <p className="text-sm text-slate-600">No public settlement receipts are available.</p>
          ) : (
            receipts.map((receipt) => (
              <div
                className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm lg:grid-cols-[1fr_1fr_auto]"
                key={receipt.id}
              >
                <span className="break-all font-medium text-slate-900">{receipt.id}</span>
                <span className="break-all text-slate-600">
                  {receipt.transactionHash ?? "No transaction hash"}
                </span>
                <span className="inline-flex items-center gap-2 text-slate-700">
                  <ExternalLink aria-hidden="true" className="h-4 w-4" />
                  Ledger {receipt.ledger ?? "pending"}
                </span>
              </div>
            ))
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Field({ label, value, wrap = false }: { label: string; value: string; wrap?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-slate-500">{label}</p>
      <p
        className={
          wrap ? "mt-1 break-all font-medium text-slate-900" : "mt-1 font-medium text-slate-900"
        }
      >
        {value}
      </p>
    </div>
  );
}
