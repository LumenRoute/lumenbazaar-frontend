"use client";

import { LogOut, PlugZap, TriangleAlert, Wallet } from "lucide-react";
import { useRef } from "react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { loadRuntimeConfig } from "@/config/runtime";
import {
  connectFreighterWallet,
  disconnectWallet,
  initialWalletState,
  type WalletConnectionState
} from "@/services/wallets";

export function WalletStatus() {
  const config = loadRuntimeConfig();
  const [connecting, setConnecting] = useState(false);
  const [wallet, setWallet] = useState<WalletConnectionState>({
    ...initialWalletState,
    expectedNetwork: config.defaultNetwork,
    expectedPassphrase: config.networks[config.defaultNetwork].passphrase
  });
  const connectButtonRef = useRef<HTMLButtonElement>(null);
  const disconnectButtonRef = useRef<HTMLButtonElement>(null);

  async function connect() {
    setConnecting(true);
    try {
      setWallet(await connectFreighterWallet(config.defaultNetwork));
    } finally {
      setConnecting(false);
    }
  }

  async function disconnect() {
    setWallet(await disconnectWallet(config.defaultNetwork));
  }

  // Status message announced via a polite live region so screen readers
  // report connection changes without stealing focus from the triggering control.
  const statusMessage =
    wallet.status === "connected"
      ? "Wallet connected"
      : wallet.status === "mismatch"
        ? `Wallet network mismatch. Expected ${wallet.expectedNetwork}`
        : wallet.status === "error" || wallet.status === "unavailable"
          ? wallet.error ?? "Wallet unavailable"
          : connecting
            ? "Connecting wallet"
            : "";

  if (wallet.status === "connected" || wallet.status === "mismatch") {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={wallet.status === "connected" ? "success" : "warning"}>
            {wallet.status === "connected" ? "Wallet connected" : "Network mismatch"}
          </Badge>
          <span className="max-w-[11rem] break-all text-sm text-slate-700" title={wallet.address}>
            {wallet.address}
          </span>
          {wallet.status === "mismatch" ? (
            <span className="inline-flex items-center gap-1 text-xs text-amber-800">
              <TriangleAlert aria-hidden="true" className="h-h-3.5 w-3.5" />
              Expected {wallet.expectedNetwork}
            </span>
          ) : null}
        </div>
        <Button
          aria-label="Disconnect wallet"
          onClick={() => void disconnect()}
          ref={disconnectButtonRef}
          type="button"
          variant="ghost"
        >
          <LogOut aria-hidden="true" className="h-4 w-4" />
        </Button>
        <span aria-live="polite" className="sr-only" role="status">
          {statusMessage}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {wallet.status === "error" || wallet.status === "unavailable" ? (
        <Badge tone="danger">{wallet.error ?? "Wallet unavailable"}</Badge>
      ) : null}
      <Button
        disabled={connecting}
        onClick={() => void connect()}
        ref={connectButtonRef}
        type="button"
        variant="secondary"
      >
        {connecting ? (
          <PlugFap aria-hidden="true" className="h-4 w-4" />
        ) : (
          <Wallet aria-hidden="true" className="h-4 w-4" />
        )}
        {connecting ? "Connecting" : "Connect Freighter"}
      </Button>
      <span aria-live="polite" className="sr-only" role="status">
        {statusMessage}
      </span>
    </div>
  );
}
