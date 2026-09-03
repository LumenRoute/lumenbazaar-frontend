import { CheckCircle2, CreditCard, FileJson, Globe2, Plus, ShieldAlert, Store } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { loadSellerDashboard } from "@/services/seller-dashboard";

export function SellerDashboard() {
  const snapshot = loadSellerDashboard();
  const readyToPublish =
    snapshot.identityStatus === "connected" && snapshot.verificationStatus === "verified";

  return (
    <>
      <PageHeader
        actions={
          <>
            <Link
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-teal-700 bg-teal-700 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-800"
              href="/seller/new-resource"
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              New resource
            </Link>
            <Link
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50"
              href="/seller/resources"
            >
              Resources
            </Link>
            <Link
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50"
              href="/seller/payments"
            >
              Payments
            </Link>
          </>
        }
        description="Track wallet identity, domain verification, resource inventory, and recent payment activity."
        title="Seller dashboard"
      />

      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <Badge tone={readyToPublish ? "success" : "warning"}>
            {readyToPublish ? "Ready to publish" : "Action required"}
          </Badge>
          <Badge tone="neutral">{snapshot.seller.domain}</Badge>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          <StatusCard icon={Store} label="Seller" tone="info" value={snapshot.seller.displayName} />
          <StatusCard
            icon={CheckCircle2}
            label="Identity"
            tone={snapshot.identityStatus === "connected" ? "success" : "warning"}
            value={snapshot.identityStatus}
          />
          <StatusCard
            icon={snapshot.verificationStatus === "verified" ? Globe2 : ShieldAlert}
            label="Domain"
            tone={snapshot.verificationStatus === "verified" ? "success" : "warning"}
            value={snapshot.verificationStatus}
          />
          <StatusCard
            icon={FileJson}
            label="Resources"
            tone="neutral"
            value={String(snapshot.resourceCount)}
          />
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-950">Recent payment attempts</h2>
            <CreditCard aria-hidden="true" className="h-5 w-5 text-teal-700" />
          </CardHeader>
          <CardBody className="space-y-3">
            {snapshot.recentPayments.length === 0 ? (
              <p className="text-sm text-slate-600">No recent payments are available.</p>
            ) : (
              snapshot.recentPayments.map((payment) => (
                <div
                  className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm md:grid-cols-[1fr_auto_auto]"
                  key={payment.id}
                >
                  <span className="break-all font-medium text-slate-900">{payment.id}</span>
                  <span className="text-slate-700">
                    {payment.amount} {payment.assetCode}
                  </span>
                  <Badge tone={payment.status === "finalized" ? "success" : "neutral"}>
                    {payment.status}
                  </Badge>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function StatusCard({
  icon: Icon,
  label,
  tone,
  value
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: "true" }>;
  label: string;
  tone: "neutral" | "success" | "warning" | "danger" | "info";
  value: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <Icon aria-hidden="true" className="h-5 w-5 text-teal-700" />
      </CardHeader>
      <CardBody>
        <Badge tone={tone}>{value}</Badge>
      </CardBody>
    </Card>
  );
}
