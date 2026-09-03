import { DashboardMetrics } from "@/components/dashboard/dashboard-metrics";
import { PageHeader } from "@/components/layout/page-header";

export default function HomePage() {
  return (
    <>
      <PageHeader
        title="LumenBazaar dashboard"
        description="Inspect Stellar x402 resources, seller readiness, payment receipts, and operator status from one testnet-first workspace."
      />
      <DashboardMetrics />
    </>
  );
}
