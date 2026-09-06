import { ExternalLink, ReceiptText } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/surfaces";
import {
  explorerTransactionUrl,
  formatPaymentAmount,
  loadSellerPaymentActivity,
  paymentActivityStatus,
  shortHash,
  type PaymentActivity
} from "@/services/payments";
import { emptyStateForCollection } from "@/services/ui-state";

export function SellerPayments({ sellerId = "seller_atlas_weather" }: { sellerId?: string }) {
  const activity = loadSellerPaymentActivity(sellerId);
  const emptyState = emptyStateForCollection("payments");

  return (
    <>
      <PageHeader
        description="Reconcile verification attempts, settlements, failure reasons, receipts, and transaction hashes."
        title="Seller payments"
      />

      {activity.length === 0 ? (
        <EmptyState title={emptyState.title} description={emptyState.description} />
      ) : (
        <Card>
          <CardHeader className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-slate-950">Recent activity</h2>
            <p className="text-sm text-slate-600">
              {activity.length} attempts across published resources
            </p>
          </CardHeader>
          <CardBody className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Attempt</th>
                  <th className="px-3 py-2 font-medium">Resource</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Failure</th>
                  <th className="px-3 py-2 font-medium">Evidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {activity.map((item) => (
                  <PaymentRow activity={item} key={item.attempt.id} />
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}
    </>
  );
}

function PaymentRow({ activity }: { activity: PaymentActivity }) {
  const status = paymentActivityStatus(activity);
  const transactionHash = activity.settlement?.transactionHash ?? activity.receipt?.transactionHash;

  return (
    <tr className="align-top">
      <td className="px-3 py-3">
        <p className="font-medium text-slate-950">{activity.attempt.id}</p>
        <p className="mt-1 break-all text-xs text-slate-500">
          {shortHash(activity.attempt.paymentHash)}
        </p>
      </td>
      <td className="px-3 py-3">
        {activity.resource ? (
          <Link
            className="font-medium text-teal-700 hover:text-teal-900"
            href={`/resources/${activity.resource.id}`}
          >
            {activity.resource.name}
          </Link>
        ) : (
          <span className="text-slate-500">Unknown resource</span>
        )}
        <p className="mt-1 text-xs text-slate-500">{activity.attempt.network}</p>
      </td>
      <td className="px-3 py-3">
        <Badge tone={paymentTone(status)}>{status}</Badge>
      </td>
      <td className="px-3 py-3 text-slate-700">
        {formatPaymentAmount(activity.attempt.amount, activity.attempt.assetCode)}
      </td>
      <td className="px-3 py-3">
        {activity.attempt.failureCode ? (
          <div className="max-w-xs">
            <Badge tone="danger">{activity.attempt.failureCode}</Badge>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              {activity.attempt.failureReason}
            </p>
          </div>
        ) : (
          <span className="text-slate-500">None</span>
        )}
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap gap-2">
          {activity.receipt ? (
            <Link
              className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-2 text-slate-700 hover:bg-slate-50"
              href={`/transactions?receipt=${activity.receipt.id}`}
            >
              <ReceiptText aria-hidden="true" className="h-4 w-4" />
              Receipt
            </Link>
          ) : null}
          {transactionHash ? (
            <a
              className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-2 text-slate-700 hover:bg-slate-50"
              href={explorerTransactionUrl(activity.attempt.network, transactionHash)}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
              Stellar
            </a>
          ) : (
            <span className="text-slate-500">Pending</span>
          )}
        </div>
      </td>
    </tr>
  );
}

function paymentTone(status: string) {
  if (status === "settled") {
    return "success";
  }

  if (status === "failed") {
    return "danger";
  }

  if (status === "verified" || status === "pending") {
    return "warning";
  }

  return "neutral";
}
