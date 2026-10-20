"use client";

import { LogOut, PlugZap, Wallet } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  WalletNetworkRecovery,
  walletRecoveryNoticeClasses,
  type WalletRecoveryBusyState,
  type WalletRecoveryNotice
} from "@/components/wallet/wallet-network-recovery";
import { networkLabel } from "@/config/networks";
import { loadRuntimeConfig } from "@/config/runtime";
import {
  connectFreighterWallet,
  describeWalletNetwork,
  disconnectWallet,
  initialWalletState,
  manualNetworkSwitchSteps,
  reconnectWallet,
  switchWalletNetwork,
  type WalletConnectionState
} from "@/services/wallets";

export function WalletStatus() {
  const config = loadRuntimeConfig();
  const [wallet, setWallet] = useState<WalletConnectionState>({
    ...initialWalletState,
    expectedNetwork: config.defaultNetwork,
    expectedPassphrase: config.networks[config.defaultNetwork].passphrase
  });
  const [busy, setBusy] = useState<WalletRecoveryBusyState>(null);
  const [notice, setNotice] = useState<WalletRecoveryNotice | undefined>(undefined);

  async function connect() {
    setNotice(undefined);
    setWallet((current) => ({ ...current, status: "connecting" }));
    setWallet(await connectFreighterWallet(config.defaultNetwork));
  }

  async function disconnect() {
    setNotice(undefined);
    setWallet(await disconnectWallet(config.defaultNetwork));
  }

  /**
   * Re-reads the wallet after the user changed the network inside the wallet.
   * The result is reported honestly: the notice states the network the wallet
   * currently reports instead of assuming the switch worked.
   */
  async function recheckNetwork() {
    setBusy("recheck");
    setNotice(undefined);

    try {
      const next = await reconnectWallet(config.defaultNetwork);
      setWallet(next);
      setNotice({
        tone: next.status === "connected" ? "success" : "warning",
        message:
          next.status === "connected"
            ? `The wallet is on ${networkLabel(next.expectedNetwork)} and is ready to sign.`
            : `The wallet is still on ${describeWalletNetwork(next)}. Switch it to ${networkLabel(next.expectedNetwork)} in the wallet, then re-check the network.`
      });
    } finally {
      setBusy(null);
    }
  }

  /**
   * Asks the wallet to move onto the expected network. The outcome is verified
   * by reading the wallet again, so the UI never claims a switch that did not
   * happen.
   */
  async function switchNetwork() {
    setBusy("switch");
    setNotice(undefined);

    try {
      const outcome = await switchWalletNetwork(config.defaultNetwork);

      if (outcome.type === "switched" || outcome.type === "already_on_expected") {
        setWallet(await reconnectWallet(config.defaultNetwork));
        setNotice({ tone: "success", message: outcome.message });
        return;
      }

      setNotice({
        tone: outcome.type === "rejected" ? "danger" : "warning",
        message: outcome.message,
        ...(outcome.type === "manual_required" ? { steps: [...manualNetworkSwitchSteps] } : {})
      });
    } finally {
      setBusy(null);
    }
  }

  if (wallet.status === "mismatch" || wallet.status === "network_unknown") {
    return (
      <div className="flex w-full flex-wrap items-center gap-2">
        <WalletNetworkRecovery
          busy={busy}
          notice={notice}
          onRecheck={() => void recheckNetwork()}
          onSwitch={() => void switchNetwork()}
          wallet={wallet}
        />
      </div>
    );
  }

  if (wallet.status === "connected") {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
        <Badge tone="success">Wallet connected</Badge>
        <span className="max-w-[11rem] break-all text-sm text-slate-700" title={wallet.address}>
          {wallet.address}
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-slate-600">
          {networkLabel(wallet.actualNetwork ?? wallet.expectedNetwork)}
        </span>
        <Button
          aria-label="Disconnect wallet"
          onClick={() => void disconnect()}
          type="button"
          variant="ghost"
        >
          <LogOut aria-hidden="true" className="h-4 w-4" />
        </Button>
        {notice ? (
          <span
            aria-live="polite"
            className={`rounded border px-2 py-1 text-xs ${walletRecoveryNoticeClasses[notice.tone]}`}
            role="status"
          >
            {notice.message}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {wallet.status === "error" || wallet.status === "unavailable" ? (
        <Badge tone="danger">{wallet.error ?? "Wallet unavailable"}</Badge>
      ) : null}
      {notice ? (
        <span
          aria-live="polite"
          className={`rounded border px-2 py-1 text-xs ${walletRecoveryNoticeClasses[notice.tone]}`}
          role="status"
        >
          {notice.message}
        </span>
      ) : null}
      <Button
        disabled={wallet.status === "connecting"}
        onClick={() => void connect()}
        type="button"
        variant="secondary"
      >
        {wallet.status === "connecting" ? (
          <PlugZap aria-hidden="true" className="h-4 w-4" />
        ) : (
          <Wallet aria-hidden="true" className="h-4 w-4" />
        )}
        {wallet.status === "connecting" ? "Connecting" : "Connect Freighter"}
      </Button>
    </div>
  );
}
