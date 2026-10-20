"use client";

import { RefreshCw, TriangleAlert, Wifi } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { networkLabel } from "@/config/networks";
import { describeWalletNetwork, type WalletConnectionState } from "@/services/wallets";

export type WalletRecoveryNotice = {
  message: string;
  steps?: string[];
  tone: "danger" | "success" | "warning";
};

export type WalletRecoveryBusyState = "recheck" | "switch" | null;

/**
 * Tone classes for a recovery notice. Shared so a notice is rendered with the
 * same severity everywhere it is shown.
 */
export const walletRecoveryNoticeClasses: Record<WalletRecoveryNotice["tone"], string> = {
  danger: "border-red-200 bg-red-50 text-red-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800"
};

/**
 * Recovery panel shown when the wallet is not on the network the frontend
 * requires for payments.
 *
 * The panel always names the expected and the current network, and offers two
 * keyboard reachable actions: switch the wallet onto the expected network and
 * re-read the wallet after the user changed it inside the wallet. Both
 * actions are plain buttons, so they are reachable with Tab and activate with
 * Enter or Space.
 */
export function WalletNetworkRecovery({
  busy,
  notice,
  onRecheck,
  onSwitch,
  wallet
}: {
  busy: WalletRecoveryBusyState;
  notice?: WalletRecoveryNotice;
  onRecheck: () => void;
  onSwitch: () => void;
  wallet: WalletConnectionState;
}) {
  const expected = networkLabel(wallet.expectedNetwork);
  const current = describeWalletNetwork(wallet);
  const unverified = wallet.status === "network_unknown";

  return (
    <section
      aria-labelledby="wallet-network-recovery-title"
      className="w-full rounded-md border border-amber-300 bg-amber-50 p-3 sm:w-96"
      role="group"
    >
      <div className="flex items-start gap-2">
        <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-amber-900" id="wallet-network-recovery-title">
              {unverified ? "Wallet network not verified" : "Wrong wallet network"}
            </p>
            <Badge tone="warning">{unverified ? "Network unknown" : "Network mismatch"}</Badge>
          </div>

          <p className="text-xs leading-5 text-amber-900">
            {unverified
              ? `The wallet did not report a network, so it cannot be confirmed to be on ${expected}. Payments stay blocked until the network can be verified.`
              : `The wallet is on ${current}. Payments require ${expected}, so signing stays blocked until the wallet is switched.`}
          </p>

          <dl className="space-y-1 text-xs text-amber-900">
            <div className="flex flex-wrap gap-x-1">
              <dt className="font-medium">Expected network:</dt>
              <dd>{expected}</dd>
            </div>
            <div className="flex flex-wrap gap-x-1">
              <dt className="font-medium">Current network:</dt>
              <dd>{current}</dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-2">
            <Button disabled={busy !== null} onClick={onSwitch} type="button" variant="secondary">
              <Wifi aria-hidden="true" className="h-4 w-4" />
              {busy === "switch" ? "Switching" : `Switch to ${expected}`}
            </Button>
            <Button disabled={busy !== null} onClick={onRecheck} type="button" variant="secondary">
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              {busy === "recheck" ? "Re-checking" : "Re-check network"}
            </Button>
          </div>

          <p
            aria-live="polite"
            className={
              notice === undefined
                ? "text-xs leading-5 text-amber-900"
                : `rounded border px-2 py-1 text-xs leading-5 ${walletRecoveryNoticeClasses[notice.tone]}`
            }
            role="status"
          >
            {notice?.message ?? ""}
          </p>

          {notice?.steps !== undefined && notice.steps.length > 0 ? (
            <ol className="list-decimal space-y-1 pl-5 text-xs leading-5 text-amber-900">
              {notice.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          ) : null}
        </div>
      </div>
    </section>
  );
}
