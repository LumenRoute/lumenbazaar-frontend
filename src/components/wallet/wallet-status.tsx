"use client";

import { LogOut, PlugZap, TriangleAlert, Wallet } from "lucide-react";
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
  const [wallet, setWallet] = useState<WalletConnectionState>({
    ...initialWalletState,
    expectedNetwork: config.defaultNetwork,
    expectedPassphrase: config.networks[config.defaultNetwork].passphrase
  });

  async function connect() {
    setWallet((current) => ({ ...current, status: "connecting" }));
    setWallet(await connectFreighterWallet(config.defaultNetwork));
  }

  async function disconnect() {
    setWallet(await disconnectWallet(config.defaultNetwork));
  }

  if (wallet.status === "connected" || wallet.status === "mismatch") {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
        <Badge tone={wallet.status === "connected" ? "success" : "warning"}>
          {wallet.status === "connected" ? "Wallet connected" : "Network mismatch"}
        </Badge>
        <span className="max-w-[11rem] break-all text-sm text-slate-700" title={wallet.address}>
          {wallet.address}
        </span>
        {wallet.status === "mismatch" ? (
          <span className="inline-flex items-center gap-1 text-xs text-amber-800">
            <TriangleAlert aria-hidden="true" className="h-3.5 w-3.5" />
            Expected {wallet.expectedNetwork}
          </span>
        ) : null}
        <Button aria-label="Disconnect wallet" onClick={disconnect} type="button" variant="ghost">
          <LogOut aria-hidden="true" className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {wallet.status === "error" || wallet.status === "unavailable" ? (
        <Badge tone="danger">{wallet.error ?? "Wallet unavailable"}</Badge>
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
