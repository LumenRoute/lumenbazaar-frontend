"use client";

import { useEffect } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/ui/surfaces";
import { assertSellerOwnership } from "@/services/seller-session";

import { useSellerSession } from "./seller-session-provider";

/**
 * Guards every seller route. Expired sessions keep rendering the page so
 * unsaved, non-sensitive drafts remain intact, but mutations stay disabled.
 */
export function SellerSessionGate({
  children,
  sellerId
}: {
  children: React.ReactNode;
  sellerId?: string;
}) {
  const { busy, canMutate, reauthenticate, refresh, signOut, state } = useSellerSession();
  const scoped = sellerId === undefined ? state : assertSellerOwnership(state, sellerId);

  useEffect(() => {
    if (state.status === "idle") {
      void refresh();
    }
  }, [refresh, state.status]);

  if (scoped.status === "idle") {
    return <LoadingState label="Checking seller session" />;
  }

  if (scoped.status === "unauthenticated") {
    return (
      <ErrorState
        code="AUTH_REQUIRED"
        description={scoped.message}
        onRetry={() => void reauthenticate()}
        title="Sign in required"
      />
    );
  }

  if (scoped.status === "ownership-denied") {
    return (
      <ErrorState
        code="SELLER_OWNERSHIP_DENIED"
        description={scoped.message}
        title="Access denied"
      />
    );
  }

  if (scoped.status === "unavailable") {
    return (
      <ErrorState
        code="BACKEND_UNAVAILABLE"
        description={scoped.message}
        onRetry={() => void refresh()}
        title="Seller authentication unavailable"
      />
    );
  }

  if (scoped.status === "expired") {
    return (
      <div className="space-y-4">
        <Card>
          <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Badge tone="warning">Session expired</Badge>
              <p className="mt-2 text-sm leading-6 text-slate-600">{scoped.message}</p>
              <p className="mt-1 text-xs text-slate-500">
                Unsaved drafts are preserved locally. Protected actions stay disabled until you
                re-authenticate.
              </p>
            </div>
            <Button disabled={busy} onClick={() => void reauthenticate()} type="button">
              {busy ? "Re-authenticating" : "Re-authenticate"}
            </Button>
          </CardBody>
        </Card>
        {children}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="success">Authenticated</Badge>
            <span className="text-sm text-slate-700">{scoped.session.seller.domain}</span>
            <span className="text-xs text-slate-500">
              Session expires {new Date(scoped.session.expiresAt).toLocaleString()}
            </span>
            {busy ? <Badge tone="info">Refreshing</Badge> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy}
              onClick={() => void reauthenticate()}
              type="button"
              variant="secondary"
            >
              Refresh session
            </Button>
            <Button
              disabled={busy}
              onClick={() => void signOut()}
              type="button"
              variant="secondary"
            >
              Sign out
            </Button>
          </div>
        </CardBody>
      </Card>
      <div aria-disabled={!canMutate}>{children}</div>
    </div>
  );
}
