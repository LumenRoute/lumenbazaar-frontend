import { PlaceholderPage } from "@/components/layout/placeholder-page";

export default function OperatorHealthPage() {
  return (
    <PlaceholderPage
      title="Operator health"
      description="Review API, worker, search, Redis, Postgres, RPC, and Horizon status without exposing secrets."
      emptyTitle="Health rows are being prepared"
      emptyDescription="This page will show service-level status, last check time, and recent failure reasons."
    />
  );
}
