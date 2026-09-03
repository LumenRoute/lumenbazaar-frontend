import { Activity, Compass, CreditCard, Store } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

const dashboardCards = [
  { href: "/explore", icon: Compass, label: "Explore resources", value: "Search catalog" },
  { href: "/seller", icon: Store, label: "Seller readiness", value: "Onboard endpoint" },
  { href: "/transactions", icon: CreditCard, label: "Payments", value: "Inspect receipts" },
  { href: "/operators", icon: Activity, label: "Operations", value: "Monitor status" }
];

export default function HomePage() {
  return (
    <>
      <PageHeader
        title="LumenBazaar dashboard"
        description="Inspect Stellar x402 resources, seller readiness, payment receipts, and operator status from one testnet-first workspace."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {dashboardCards.map((card) => {
          const Icon = card.icon;

          return (
            <Link key={card.href} href={card.href}>
              <Card className="h-full transition hover:border-teal-300 hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between gap-3">
                  <h2 className="text-sm font-medium text-slate-600">{card.label}</h2>
                  <Icon aria-hidden="true" className="h-5 w-5 text-teal-700" />
                </CardHeader>
                <CardBody>
                  <p className="text-xl font-semibold text-slate-950">{card.value}</p>
                </CardBody>
              </Card>
            </Link>
          );
        })}
      </div>
    </>
  );
}
