"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { isDemoMode, loadRuntimeConfig } from "@/config/runtime";
import {
  canMutateSellerSession,
  createDemoSellerSession,
  createDemoSellerSessionClient,
  createSellerSessionClient,
  loadSellerSessionWithRefresh,
  resolveSellerSessionState,
  sellerSessionStateFromError,
  type SellerSession,
  type SellerSessionClient,
  type SellerSessionState
} from "@/services/seller-session";

export type SellerSessionContextValue = {
  busy: boolean;
  canMutate: boolean;
  reauthenticate: () => Promise<void>;
  refresh: () => Promise<void>;
  session: SellerSession | null;
  signOut: () => Promise<void>;
  state: SellerSessionState;
};

const SellerSessionContext = createContext<SellerSessionContextValue>({
  busy: false,
  canMutate: false,
  reauthenticate: async () => undefined,
  refresh: async () => undefined,
  session: null,
  signOut: async () => undefined,
  state: {
    message: "No seller session provider is available. Protected actions are disabled.",
    status: "unavailable"
  }
});

export function useSellerSession() {
  return useContext(SellerSessionContext);
}

export function SellerSessionProvider({
  children,
  client,
  now
}: {
  children: React.ReactNode;
  client?: SellerSessionClient;
  now?: () => number;
}) {
  const demo = isDemoMode(loadRuntimeConfig().environment);
  const nowFn = useMemo(() => now ?? (() => Date.now()), [now]);
  const sessionClient = useMemo(
    () =>
      client ??
      (demo ? createDemoSellerSessionClient({ now: nowFn }) : createSellerSessionClient()),
    [client, demo, nowFn]
  );
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<SellerSessionState>(() =>
    demo
      ? resolveSellerSessionState(createDemoSellerSession({ now: nowFn }), nowFn())
      : { status: "idle" }
  );

  const refresh = useCallback(async () => {
    setBusy(true);

    try {
      setState(await loadSellerSessionWithRefresh(sessionClient, nowFn()));
    } finally {
      setBusy(false);
    }
  }, [nowFn, sessionClient]);

  const reauthenticate = useCallback(async () => {
    setBusy(true);

    try {
      const session = await sessionClient.refreshSession();
      setState(resolveSellerSessionState(session, nowFn()));
    } catch (error) {
      setState(sellerSessionStateFromError(error));
    } finally {
      setBusy(false);
    }
  }, [nowFn, sessionClient]);

  const signOut = useCallback(async () => {
    try {
      await sessionClient.signOut();
    } catch {
      // Local state still fails closed even when the backend is unreachable.
    } finally {
      setState({
        message: "You have signed out of the seller dashboard.",
        status: "unauthenticated"
      });
    }
  }, [sessionClient]);

  useEffect(() => {
    if (state.status !== "authenticated") return undefined;

    const expiresAt = Date.parse(state.session.expiresAt);

    if (!Number.isFinite(expiresAt)) return undefined;

    const timer = window.setTimeout(
      () => {
        setState((current) =>
          current.status === "authenticated"
            ? resolveSellerSessionState(current.session, nowFn())
            : current
        );
      },
      Math.max(expiresAt - nowFn(), 0)
    );

    return () => window.clearTimeout(timer);
  }, [nowFn, state]);

  const value = useMemo<SellerSessionContextValue>(
    () => ({
      busy,
      canMutate: canMutateSellerSession(state),
      reauthenticate,
      refresh,
      session: state.status === "authenticated" ? state.session : null,
      signOut,
      state
    }),
    [busy, reauthenticate, refresh, signOut, state]
  );

  return <SellerSessionContext.Provider value={value}>{children}</SellerSessionContext.Provider>;
}
