"use client";

import { LogOut, PlugZap, Wallet } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useSyncExternalStore, useState } from "react";
import { useEffect, useRef } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  WalletNetworkRecovery,
  walletRecoveryNoticeClasses,
  type WalletRecoveryBusyState,
  type WalletRecoveryNotice
} from "@/components/wallet/wallet-network-recovery";
import { getNetworkConfig, networkLabel } from "@/config/networks";
import { loadRuntimeConfig } from "@/config/runtime";
import {
  connectFreighterWallet,
  describeWalletNetwork,
  disconnectWallet,
  initialWalletState,
  loadWalletProviderPreference,
  manualNetworkSwitchSteps,
  reconnectWallet,
  resetWalletProviderPreference,
  resolveWalletProvider,
  saveWalletProviderPreference,
  subscribeWalletProviderPreference,
  switchWalletNetwork,
  walletProviders,
  revalidateWalletSession,
  revalidateWalletSession,
  switchWalletNetwork,
  walletProviders,
  type WalletConnectionState,
  type WalletSessionRevalidation
} from "@/services/wallets";

/** Provider events a host or wallet adapter can dispatch after a wallet change. */
const walletProviderEvents = [
  "freighter:accountChanged",
  "freighter:networkChanged",
  "stellar:walletChanged"
] as const;

export function WalletStatus() {
  const config = loadRuntimeConfig();
  const [connecting, setConnecting] = useState(false);
  const [wallet, setWallet] = useState<WalletConnectionState>({
    ...initialWalletState,
    expectedNetwork: config.defaultNetwork,
    expectedPassphrase: getNetworkConfig(config.defaultNetwork).passphrase
  });
  const [busy, setBusy] = useState<WalletRecoveryBusyState>(null);
  const [notice, setNotice] = useState<WalletRecoveryNotice | undefined>(undefined);
  const walletRef = useRef(wallet);

  useEffect(() => {
    walletRef.current = wallet;
  }, [wallet]);

  // A restored tab can show a session the wallet no longer has. Re-read the
  // wallet whenever the tab becomes visible again, is restored, or the provider
  // reports a change, and keep listening only while this component is mounted.
  useEffect(() => {
    let cancelled = false;

    async function revalidate() {
      const current = walletRef.current;

      if (document.visibilityState === "hidden") return;
      if (
        current.status === "disconnected" ||
        current.status === "connecting" ||
        current.status === "error" ||
        current.status === "unavailable"
      ) {
        return;
      }

      const result = await revalidateWalletSession(current, config.defaultNetwork);

      if (cancelled) return;

      setWallet(result.wallet);

      const changeNotice = noticeForSessionChange(result);

      if (changeNotice !== undefined) {
        setNotice(changeNotice);
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") void revalidate();
    }

    function handleProviderChange() {
      void revalidate();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleProviderChange);
    window.addEventListener("pageshow", handleProviderChange);
    for (const eventName of walletProviderEvents) {
      window.addEventListener(eventName, handleProviderChange);
    }

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleProviderChange);
      window.removeEventListener("pageshow", handleProviderChange);
      for (const eventName of walletProviderEvents) {
        window.removeEventListener(eventName, handleProviderChange);
      }
    };
  }, [config.defaultNetwork]);

  // Storage is external state; the server snapshot stays empty and the browser
  // snapshot picks up the saved provider without an extra state write.
  const preference = useSyncExternalStore(
    subscribeWalletProviderPreference,
    loadWalletProviderPreference,
    () => undefined
  );

  async function connect() {
    setNotice(undefined);

    // A saved provider that is no longer available must surface a provider
    // choice instead of silently approving the connection.
    const selection = resolveWalletProvider(preference);

    if (preference !== undefined && selection.provider === undefined) {
      setNotice({ tone: "warning", message: selection.message });
      return;
    }

    setConnecting(true);
    setWallet((current) => ({ ...current, status: "connecting" }));

    try {
      const next = await connectFreighterWallet(config.defaultNetwork);
      setWallet(next);

      if (next.status === "connected" || next.status === "mismatch") {
        saveWalletProviderPreference("freighter");
      } else if (next.status === "unavailable") {
        setNotice({
          tone: "warning",
          message: next.error ?? "The wallet provider is unavailable."
        });
      }
    } finally {
      setConnecting(false);
    }
  }

  async function disconnect() {
    setNotice(undefined);
    setWallet(await disconnectWallet(config.defaultNetwork));
  }

  function forgetProvider() {
    resetWalletProviderPreference();
    setNotice({
      message: "Saved wallet provider cleared. Choose a provider to connect again.",
      tone: "success"
    });
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

  const savedProvider =
    preference === undefined
      ? undefined
      : walletProviders.find((provider) => provider.id === preference);

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
      {savedProvider ? (
        <span className="inline-flex items-center gap-1 text-xs text-slate-600">
          Saved provider: {savedProvider.label}
          <Button onClick={forgetProvider} type="button" variant="ghost">
            Forget
          </Button>
        </span>
      ) : null}
      <Button
        disabled={connecting}
        onClick={() => void connect()}
        type="button"
        variant="secondary"
      >
        {connecting ? (
          <PlugZap aria-hidden="true" className="h-4 w-4" />
        ) : (
          <Wallet aria-hidden="true" className="h-4 w-4" />
        )}
        {connecting ? "Connecting" : "Connect Freighter"}
      </Button>
      <span aria-live="polite" className="sr-only" role="status">
        {wallet.status === "connecting" ? "Connecting to the wallet." : "Wallet disconnected."}
      </span>
    </div>
  );
}

/**
 * Distinct recovery copy for each way a restored session can be stale. Account
 * and network changes are never collapsed into one message.
 */
function noticeForSessionChange(
  result: WalletSessionRevalidation
): WalletRecoveryNotice | undefined {
  switch (result.change) {
    case "account_changed":
      return {
        message:
          "The active wallet account changed. Reconnect and review the account before authorizing payments.",
        tone: "danger"
      };
    case "network_changed":
      return {
        message: `The wallet network changed to ${describeWalletNetwork(result.wallet)}. Payments require ${networkLabel(result.wallet.expectedNetwork)}.`,
        tone: "warning"
      };
    case "network_unverified":
      return {
        message:
          "The wallet did not report its network, so payments stay blocked until it can be verified.",
        tone: "warning"
      };
    case "disconnected":
      return {
        message: "The wallet session is no longer active. Reconnect to continue.",
        tone: "warning"
      };
    case "unavailable":
      return {
        message: "The wallet could not be re-read. Payments stay blocked until it reconnects.",
        tone: "danger"
      };
    case "unchanged":
      return undefined;
  }
}
