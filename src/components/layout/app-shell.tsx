import {
  Activity,
  BookOpen,
  Compass,
  CreditCard,
  LayoutDashboard,
  Play,
  Settings,
  ShieldCheck,
  Store,
  Wrench
} from "lucide-react";
import Link from "next/link";

import { loadRuntimeConfig } from "@/config/runtime";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/explore", icon: Compass, label: "Explore" },
  { href: "/seller", icon: Store, label: "Seller" },
  { href: "/playground", icon: Play, label: "Playground" },
  { href: "/transactions", icon: CreditCard, label: "Transactions" },
  { href: "/operators", icon: Activity, label: "Operators" },
  { href: "/operators/health", icon: ShieldCheck, label: "Health" },
  { href: "/operators/conformance", icon: Wrench, label: "Conformance" },
  { href: "/docs", icon: BookOpen, label: "Docs" },
  { href: "/settings", icon: Settings, label: "Settings" }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const config = loadRuntimeConfig();
  const network = config.networks[config.defaultNetwork];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/" className="flex min-h-10 items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-teal-700 text-sm font-semibold text-white">
                LB
              </span>
              <span>
                <span className="block text-base font-semibold text-slate-950">LumenBazaar</span>
                <span className="block text-xs text-slate-500">Stellar x402 dashboard</span>
              </span>
            </Link>
            <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
              {network.label}
            </div>
          </div>
          <nav aria-label="Primary navigation" className="overflow-x-auto">
            <div className="flex min-w-max gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="inline-flex min-h-10 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                  >
                    <Icon aria-hidden="true" className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
