import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createDemoSellerSession, SellerSessionError } from "@/services/seller-session";

import { SellerSessionGate } from "./seller-session-gate";
import { SellerSessionProvider } from "./seller-session-provider";

const now = Date.parse("2026-10-18T12:00:00.000Z");

function renderGate({
  client,
  sellerId
}: {
  client: Parameters<typeof SellerSessionProvider>[0]["client"];
  sellerId?: string;
}) {
  return render(
    <SellerSessionProvider client={client} now={() => now}>
      <SellerSessionGate {...(sellerId === undefined ? {} : { sellerId })}>
        <p>Seller draft workspace</p>
      </SellerSessionGate>
    </SellerSessionProvider>
  );
}

describe("SellerSessionGate", () => {
  it("renders seller content for an authenticated session", async () => {
    renderGate({
      client: {
        fetchSession: async () => createDemoSellerSession({ now: () => now }),
        refreshSession: async () => createDemoSellerSession({ now: () => now }),
        signOut: async () => undefined
      }
    });

    expect(await screen.findByText("Seller draft workspace")).toBeInTheDocument();
    expect(screen.getByText("Authenticated")).toBeInTheDocument();
  });

  it("keeps drafts rendered but locks down when the session expired", async () => {
    const expired = new SellerSessionError({
      code: "expired",
      message: "expired",
      status: 401
    });

    renderGate({
      client: {
        fetchSession: async () => Promise.reject(expired),
        refreshSession: async () => Promise.reject(expired),
        signOut: async () => undefined
      }
    });

    expect(await screen.findByText("Session expired")).toBeInTheDocument();
    expect(screen.getByText("Seller draft workspace")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Re-authenticate" })).toBeEnabled();
  });

  it("hides seller content for unauthenticated sessions", async () => {
    const unauthenticated = new SellerSessionError({
      code: "unauthenticated",
      message: "no session",
      status: 401
    });

    renderGate({
      client: {
        fetchSession: async () => Promise.reject(unauthenticated),
        refreshSession: async () => Promise.reject(unauthenticated),
        signOut: async () => undefined
      }
    });

    expect(await screen.findByText("Sign in required")).toBeInTheDocument();
    expect(screen.queryByText("Seller draft workspace")).not.toBeInTheDocument();
  });

  it("reports cross-seller access separately from backend unavailability", async () => {
    const session = createDemoSellerSession({ now: () => now });
    const { unmount } = renderGate({
      client: {
        fetchSession: async () => session,
        refreshSession: async () => session,
        signOut: async () => undefined
      },
      sellerId: "seller_someone_else"
    });

    expect(await screen.findByText("Access denied")).toBeInTheDocument();
    unmount();

    renderGate({
      client: {
        fetchSession: async () => Promise.reject(new Error("offline")),
        refreshSession: async () => Promise.reject(new Error("offline")),
        signOut: async () => undefined
      }
    });

    expect(await screen.findByText("Seller authentication unavailable")).toBeInTheDocument();
  });
});
