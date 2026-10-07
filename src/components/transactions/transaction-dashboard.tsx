"use client";

import { ExternalLink, Filter, ReceiptText, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, ErrorState } from "@/components/ui/surfaces";
import { demoSellers } from "@/fixtures/lumenbazaar";
import type { NetworkId } from "@/config/networks";
import { isDemoMode, loadRuntimeConfig } from "@/config/runtime";
import {
  explorerTransactionUrl,
  formatPaymentAmount,
  loadPaymentActivity,
  paymentActivityStatus,
  shortHash,
  type PaymentActivity,
  type PaymentActivityStatus
} from "@/services/payments";

const allStatuses: Array<PaymentActivityStatus | "all"> = [
  "all",
  "received",
  "verified",
  "pending",
  "settled",
  "failed"
];

export function TransactionDashboard() {
  const mode = loadRuntimeConfig().environment;
  const demo = isDemoMode(mode);
  const [network, setNetwork] = useState<NetworkId | "all">("all");
  const [status, setStatus] = useState<PaymentActivityStatus | "all">("all");
  const [asset, setAsset] = useState("all");
  const [sellerId, setSellerId] = useState("all");
  const [date, setDate] = useState("");
  const activity = useMemo(
    () =>
      demo
        ? loadPaymentActivity(
            {
              ...(asset === "all" ? {} : { asset }),
              ...(date === "" ? {} : { date }),
              ...(network === "all" ? {} : { network }),
              ...(sellerId === "all" ? {} : { sellerId }),
              ...(status === "all" ? {} : { status })
            },
            mode
          )
        : [],
    [asset, date, demo, mode, network, sellerId, status]
  );
  const assets = useMemo(
    () =>
      demo ? [...new Set(loadPaymentActivity({}, mode).map((item) => item.attempt.assetCode))] : [],
    [demo, mode]
  );
  const hasFilters =
    network !== "all" || status !== "all" || asset !== "all" || sellerId !== "all" || date !== "";

  if (!demo) {
    return (
      <>
        <PageHeader
          description="Inspect payment attempts, settlements, failure codes, receipts, and Stellar transaction evidence."
          title="Transactions"
        />
        <ErrorState
          code="BACKEND_UNAVAILABLE"
          description="A payment-attempt listing endpoint is not available in the reviewed backend contract. No demo transactions are shown in live modes."
          title="Transactions unavailable"
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        description="Inspect payment attempts, settlements, failure codes, receipts, and Stellar transaction evidence."
        title="Transactions"
      />

      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-col gap-1">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
              <Filter aria-hidden="true" className="h-5 w-5 text-teal-700" />
              Filters
            </h2>
            <p className="text-sm text-slate-600">
              Filter by network, status, asset, seller, and date.
            </p>
          </CardHeader>
          <CardBody className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Network</span>
              <select
                className="min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-slate-950"
                onChange={(event) => setNetwork(event.target.value as NetworkId | "all")}
                value={network}
              >
                <option value="all">All networks</option>
                <option value="stellar:testnet">stellar:testnet</option>
                <option value="stellar:pubnet">stellar:pubnet</option>
              </select>
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Status</span>
              <select
                className="min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-slate-950"
                onChange={(event) => setStatus(event.target.value as PaymentActivityStatus | "all")}
                value={status}
              >
                {allStatuses.map((option) => (
                  <option key={option} value={option}>
                    {option === "all" ? "All statuses" : option}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Asset</span>
              <select
                className="min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-slate-950"
                onChange={(event) => setAsset(event.target.value)}
                value={asset}
              >
                <option value="all">All assets</option>
                {assets.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Seller</span>
              <select
                className="min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-slate-950"
                onChange={(event) => setSellerId(event.target.value)}
                value={sellerId}
              >
                <option value="all">All sellers</option>
                {demoSellers.map((seller) => (
                  <option key={seller.id} value={seller.id}>
                    {seller.displayName}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Date</span>
              <input
                className="min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-slate-950"
                onChange={(event) => setDate(event.target.value)}
                type="date"
                value={date}
              />
            </label>

            {hasFilters ? (
              <div className="md:col-span-2 xl:col-span-5">
                <Button
                  onClick={() => {
                    setNetwork("all");
                    setStatus("all");
                    setAsset("all");
                    setSellerId("all");
                    setDate("");
                  }}
                  type="button"
                  variant="secondary"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                  Clear filters
                </Button>
              </div>
            ) : null}
          </CardBody>
        </Card>

        {activity.length === 0 ? (
          <EmptyState
            title="No transactions match the filters"
            description="Clear filters or wait for verification and settlement activity to be indexed."
          />
        ) : (
          <Card>
            <CardHeader className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold text-slate-950">Payment activity</h2>
              <p className="text-sm text-slate-600">{activity.length} attempt records loaded</p>
            </CardHeader>
            <CardBody className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Attempt</th>
                    <th className="px-3 py-2 font-medium">Seller</th>
                    <th className="px-3 py-2 font-medium">Resource</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Amount</th>
                    <th className="px-3 py-2 font-medium">Created</th>
                    <th className="px-3 py-2 font-medium">Failure</th>
                    <th className="px-3 py-2 font-medium">Evidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {activity.map((item) => (
                    <TransactionRow activity={item} key={item.attempt.id} />
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}

function TransactionRow({ activity }: { activity: PaymentActivity }) {
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
        <p className="font-medium text-slate-800">
          {activity.seller?.displayName ?? activity.attempt.sellerId}
        </p>
        <p className="mt-1 break-all text-xs text-slate-500">{activity.seller?.domain}</p>
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
          <span className="text-slate-500">{activity.attempt.resourceId}</span>
        )}
        <p className="mt-1 text-xs text-slate-500">{activity.resource?.type ?? "unknown"}</p>
      </td>
      <td className="px-3 py-3">
        <Badge tone={transactionTone(status)}>{status}</Badge>
      </td>
      <td className="px-3 py-3 text-slate-700">
        <span className="block">
          {formatPaymentAmount(activity.attempt.amount, activity.attempt.assetCode)}
        </span>
        <span className="block break-all text-xs text-slate-500">{activity.attempt.network}</span>
      </td>
      <td className="px-3 py-3 text-slate-700">
        {new Intl.DateTimeFormat("en", {
          dateStyle: "medium",
          timeStyle: "short"
        }).format(new Date(activity.attempt.createdAt))}
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
              {activity.receipt.id}
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
              {shortHash(transactionHash)}
            </a>
          ) : (
            <span className="text-slate-500">Pending</span>
          )}
        </div>
      </td>
    </tr>
  );
}

function transactionTone(status: PaymentActivityStatus) {
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
