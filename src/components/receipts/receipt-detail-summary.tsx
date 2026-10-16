import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { explorerTransactionUrl, isValidTransactionHash, isSyntheticTransactionId } from "@/services/payments";
import type { Receipt } from "@/services/api/schemas";

type ReceiptDetailSummaryProps = {
  receipt: Receipt;
};

export function ReceiptDetailSummary({ receipt }: ReceiptDetailSummaryProps) {
  const isFinalized = receipt.status === "finalized";
  const isFailed = receipt.status === "failed";
  const isPending = receipt.status === "pending";

  const statusTone = isFinalized ? "success" : isFailed ? "danger" : "warning";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <Badge tone={statusTone}>{receipt.status}</Badge>
        <Badge tone={receipt.network === "stellar:testnet" ? "warning" : "neutral"}>
          {receipt.network === "stellar:testnet" ? "Testnet" : "Mainnet"}
        </Badge>
        {receipt.resourceId && <Badge tone="info">Has resource</Badge>}
        {receipt.sellerId && <Badge tone="info">Has seller</Badge>}
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-950">Receipt information</h2>
        </CardHeader>
        <CardBody className="grid gap-4 text-sm md:grid-cols-2 xl:grid-cols-3">
          <Field label="Receipt ID" value={receipt.id} wrap />
          <Field label="Status" value={receipt.status} />
          <Field label="Network" value={receipt.network} />
          <Field label="Amount" value={`${receipt.amount} ${receipt.assetCode}`} />
          <Field label="Asset issuer" value={receipt.assetIssuer} wrap />
          <Field label="Created at" value={formatIsoDate(receipt.createdAt)} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-950">Payment verification</h2>
        </CardHeader>
        <CardBody className="grid gap-4 text-sm md:grid-cols-2 xl:grid-cols-3">
          <Field label="Payment attempt ID" value={receipt.paymentAttemptId} wrap />
          <Field label="Correlation ID" value={receipt.correlationId} wrap />
          <Field label="Evidence hash" value={receipt.evidenceHash} wrap />
          <Field label="Updated at" value={formatIsoDate(receipt.updatedAt)} />
        </CardBody>
      </Card>

      {isFinalized && receipt.transactionHash && isValidTransactionHash(receipt.transactionHash) && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-950">Finality confirmation</h2>
          </CardHeader>
          <CardBody className="space-y-4 text-sm">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3">
                <p className="text-slate-500">Transaction hash</p>
                <p className="mt-1 break-all font-medium text-slate-900">{receipt.transactionHash}</p>
              </div>
              <div className="mb-3">
                <p className="text-slate-500">Ledger</p>
                <p className="mt-1 font-medium text-slate-900">
                  {receipt.ledger ?? "Unknown"}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Settled at</p>
                <p className="mt-1 font-medium text-slate-900">
                  {receipt.settledAt ? formatIsoDate(receipt.settledAt) : "Pending"}
                </p>
              </div>
            </div>
            {(() => {
              const explorerUrl = explorerTransactionUrl(receipt.network, receipt.transactionHash);
              return explorerUrl ? (
                <a
                  className="inline-flex items-center gap-2 rounded-md bg-blue-50 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-100"
                  href={explorerUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <ExternalLink aria-hidden="true" className="h-4 w-4" />
                  View on Stellar explorer
                </a>
              ) : (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  Transaction hash is invalid and cannot be verified on the explorer.
                </div>
              );
            })()}
          </CardBody>
        </Card>
      )}

      {isFinalized && receipt.transactionHash && isSyntheticTransactionId(receipt.transactionHash) && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-950">Simulation data</h2>
          </CardHeader>
          <CardBody className="space-y-4 text-sm">
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="font-medium text-amber-900">This is test or simulation data, not a real on-chain transaction.</p>
              <p className="mt-1 text-amber-800">
                Synthetic identifiers like "<code className="font-mono">{receipt.transactionHash}</code>" cannot be verified on the Stellar explorer.
              </p>
            </div>
          </CardBody>
        </Card>
      )}

      {isFinalized && receipt.transactionHash && !isValidTransactionHash(receipt.transactionHash) && !isSyntheticTransactionId(receipt.transactionHash) && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-950">Finality confirmation</h2>
          </CardHeader>
          <CardBody className="space-y-4 text-sm">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3">
                <p className="text-slate-500">Transaction hash</p>
                <p className="mt-1 break-all font-medium text-slate-900">{receipt.transactionHash}</p>
              </div>
              <div className="mb-3">
                <p className="text-slate-500">Ledger</p>
                <p className="mt-1 font-medium text-slate-900">
                  {receipt.ledger ?? "Unknown"}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Settled at</p>
                <p className="mt-1 font-medium text-slate-900">
                  {receipt.settledAt ? formatIsoDate(receipt.settledAt) : "Pending"}
                </p>
              </div>
            </div>
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Transaction hash is invalid and cannot be verified on the explorer.
            </div>
          </CardBody>
        </Card>
      )}

      {isFailed && (receipt.failureCode || receipt.failureReason) && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-950">Failure information</h2>
          </CardHeader>
          <CardBody className="grid gap-4 text-sm md:grid-cols-2">
            {receipt.failureCode && <Field label="Failure code" value={receipt.failureCode} />}
            {receipt.failureReason && (
              <Field label="Failure reason" value={receipt.failureReason} wrap />
            )}
          </CardBody>
        </Card>
      )}

      {isPending && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-950">Pending settlement</h2>
          </CardHeader>
          <CardBody className="text-sm text-slate-600">
            <p>This receipt is awaiting finalization on the Stellar network. Transaction details will appear once the settlement is confirmed.</p>
          </CardBody>
        </Card>
      )}

      {receipt.resourceId && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-950">Associated resource</h2>
          </CardHeader>
          <CardBody className="text-sm">
            <Field label="Resource ID" value={receipt.resourceId} wrap />
          </CardBody>
        </Card>
      )}

      {receipt.sellerId && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-950">Seller information</h2>
          </CardHeader>
          <CardBody className="text-sm">
            <Field label="Seller ID" value={receipt.sellerId} wrap />
          </CardBody>
        </Card>
      )}
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

function formatIsoDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  } catch {
    return isoString;
  }
}
