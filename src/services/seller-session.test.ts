import { describe, expect, it } from "vitest";

import {
  assertSellerOwnership,
  createDemoSellerSession,
  createDemoSellerSessionClient,
  createSellerSessionClient,
  loadSellerSessionWithRefresh,
  resolveSellerSessionState,
  SellerSessionError,
  sellerSessionStateFromError
} from "./seller-session";

const now = Date.parse("2026-10-18T12:00:00.000Z");

function session(overrides: { expiresAt?: string; sellerId?: string } = {}) {
  const record = createDemoSellerSession({ now: () => now });

  return {
    ...record,
    expiresAt: overrides.expiresAt ?? record.expiresAt,
    seller: {
      ...record.seller,
      id: overrides.sellerId ?? record.seller.id
    }
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status
  });
}

describe("seller session state", () => {
  it("treats a valid future expiry as authenticated", () => {
    const state = resolveSellerSessionState(session(), now);

    expect(state.status).toBe("authenticated");
  });

  it("expires sessions at the boundary and fails closed", () => {
    const state = resolveSellerSessionState(
      session({ expiresAt: new Date(now).toISOString() }),
      now
    );

    expect(state.status).toBe("expired");
    expect(
      sellerSessionStateFromError(
        new SellerSessionError({ code: "expired", message: "x", status: 401 })
      ).status
    ).toBe("expired");
  });

  it("treats malformed expiry timestamps as expired", () => {
    expect(resolveSellerSessionState(session({ expiresAt: "not-a-timestamp" }), now).status).toBe(
      "expired"
    );
  });

  it("denies cross-seller access with a distinct state", () => {
    const state = resolveSellerSessionState(session(), now);

    if (state.status !== "authenticated") throw new Error("expected an authenticated session");

    const denied = assertSellerOwnership(state, "seller_someone_else");

    expect(denied.status).toBe("ownership-denied");
    expect(denied.status === "ownership-denied" ? denied.message : "").toContain(
      "seller_someone_else"
    );
    expect(assertSellerOwnership(state, state.session.seller.id).status).toBe("authenticated");
  });
});

describe("seller session client", () => {
  it("loads the current session from the backend with credentialed requests", async () => {
    const requests: Array<{ init?: RequestInit; url: string }> = [];
    const client = createSellerSessionClient({
      baseUrl: "https://api.example.test",
      fetchImpl: async (input, init) => {
        requests.push({ init, url: String(input) });
        return jsonResponse(session());
      }
    });

    const state = await loadSellerSessionWithRefresh(client, now);

    expect(state.status).toBe("authenticated");
    expect(requests[0]?.url).toBe("https://api.example.test/v1/seller/session");
    expect(requests[0]?.init?.credentials).toBe("include");
  });

  it("silently refreshes once when the session is missing", async () => {
    const paths: string[] = [];
    const client = createSellerSessionClient({
      baseUrl: "https://api.example.test",
      fetchImpl: async (input) => {
        const url = String(input);
        paths.push(url);

        if (url.endsWith("/refresh")) return jsonResponse(session());

        return jsonResponse({ error: { code: "AUTH_REQUIRED", message: "sign in" } }, 401);
      }
    });

    const state = await loadSellerSessionWithRefresh(client, now);

    expect(state.status).toBe("authenticated");
    expect(paths).toEqual([
      "https://api.example.test/v1/seller/session",
      "https://api.example.test/v1/seller/session/refresh"
    ]);
  });

  it("does not enable mutations when refresh is rejected", async () => {
    const client = createSellerSessionClient({
      baseUrl: "https://api.example.test",
      fetchImpl: async () =>
        jsonResponse({ error: { code: "AUTH_EXPIRED", message: "expired" } }, 401)
    });

    const state = await loadSellerSessionWithRefresh(client, now);

    expect(state.status).toBe("expired");
  });

  it("distinguishes ownership denial from backend unavailability", async () => {
    const denied = createSellerSessionClient({
      baseUrl: "https://api.example.test",
      fetchImpl: async () => jsonResponse({ error: { code: "FORBIDDEN", message: "no" } }, 403)
    });
    const unavailable = createSellerSessionClient({
      baseUrl: "https://api.example.test",
      fetchImpl: async () => jsonResponse({ error: { code: "NOT_FOUND", message: "no" } }, 404)
    });

    expect((await loadSellerSessionWithRefresh(denied, now)).status).toBe("ownership-denied");
    expect((await loadSellerSessionWithRefresh(unavailable, now)).status).toBe("unavailable");
  });

  it("fails closed on network errors and malformed session payloads", async () => {
    const offline = createSellerSessionClient({
      baseUrl: "https://api.example.test",
      fetchImpl: async () => Promise.reject(new Error("offline"))
    });
    const malformed = createSellerSessionClient({
      baseUrl: "https://api.example.test",
      fetchImpl: async () => jsonResponse({ sessionId: "missing-fields" })
    });

    expect((await loadSellerSessionWithRefresh(offline, now)).status).toBe("unavailable");
    expect((await loadSellerSessionWithRefresh(malformed, now)).status).toBe("unavailable");
  });

  it("clears the in-memory demo session on logout", async () => {
    const client = createDemoSellerSessionClient({ now: () => now });
    await client.refreshSession();
    await client.signOut();

    await expect(client.fetchSession()).rejects.toMatchObject({ code: "unauthenticated" });
  });
});
