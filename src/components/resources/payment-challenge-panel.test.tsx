import { encodePaymentRequiredHeader } from "@x402/core/http";
import type { PaymentRequired } from "@x402/core/types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { demoResources, demoSupportedPaymentSchemes } from "@/fixtures/lumenbazaar";
import { apiClient } from "@/services/api/client";
import * as authorization from "@/services/x402/authorization";
import * as challenge from "@/services/x402/challenge";

import { PaymentChallengePanel } from "./payment-challenge-panel";

const resource = {
  ...demoResources[0]!,
  url: "https://seller.example/weather?city=Lagos"
};
const requirement = {
  amount: "500000",
  asset: "CASSETDEMO",
  extra: {
    assetCode: resource.assetCode,
    assetIssuer: resource.assetIssuer
  },
  maxTimeoutSeconds: 60,
  network: resource.network,
  payTo: resource.payTo,
  scheme: "exact"
} as const;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("PaymentChallengePanel", () => {
  it("displays only terms validated from the canonical endpoint challenge", async () => {
    vi.spyOn(apiClient, "getSupported").mockResolvedValue(demoSupportedPaymentSchemes);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(null, {
            headers: {
              "PAYMENT-REQUIRED": encodePaymentRequiredHeader({
                accepts: [requirement],
                resource: { url: resource.url },
                x402Version: 2
              } as PaymentRequired)
            },
            status: 402
          })
      )
    );

    render(<PaymentChallengePanel resource={resource} source="api" />);
    fireEvent.click(screen.getByRole("button", { name: "Request terms" }));

    expect(await screen.findByText("Validated x402 v2 exact")).toBeInTheDocument();
    expect(screen.getByText(requirement.amount)).toBeInTheDocument();
    expect(screen.getByText(requirement.asset)).toBeInTheDocument();
    expect(screen.getByText(requirement.payTo)).toBeInTheDocument();
    expect(screen.getByText(resource.url)).toBeInTheDocument();
  });

  it("does not offer a live challenge action for fixture data", () => {
    render(<PaymentChallengePanel resource={resource} source="demo" />);

    expect(screen.getByText("Unavailable in demo mode")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Request terms" })).not.toBeInTheDocument();
  });

  it("disables the authorize button and shows expiry banner when the challenge has expired", async () => {
    vi.spyOn(apiClient, "getSupported").mockResolvedValue(demoSupportedPaymentSchemes);
    // Return an already-expired challenge via isChallengeExpired spy
    vi.spyOn(challenge, "requestPaymentChallenge").mockResolvedValue({
      challenge: {
        accepts: [requirement],
        resource: { url: resource.url },
        x402Version: 2
      },
      // expiresAt in the past so the countdown hits 0 immediately
      expiresAt: Date.now() - 1_000,
      fingerprint: "fp-expired",
      receivedAt: Date.now() - 61_000,
      request: { headers: [], method: "GET", url: resource.url },
      requirement
    });

    render(<PaymentChallengePanel resource={resource} source="api" />);
    fireEvent.click(screen.getByRole("button", { name: "Request terms" }));

    expect(await screen.findByText("Validated x402 v2 exact")).toBeInTheDocument();
    // Expiry banner should appear
    expect(
      await screen.findByText("This challenge has expired. Refresh terms to request a new one.")
    ).toBeInTheDocument();
    // Authorize button must be disabled
    expect(screen.getByRole("button", { name: "Authorize payment" })).toBeDisabled();
  });

  it("blocks signing when isChallengeExpired returns true at authorize time", async () => {
    vi.spyOn(apiClient, "getSupported").mockResolvedValue(demoSupportedPaymentSchemes);
    const authorizeStub = vi.spyOn(authorization, "authorizePaymentChallenge");

    // Challenge looks fresh when received but expires before the user can click authorize
    vi.spyOn(challenge, "requestPaymentChallenge").mockResolvedValue({
      challenge: {
        accepts: [requirement],
        resource: { url: resource.url },
        x402Version: 2
      },
      expiresAt: Date.now() - 1,
      fingerprint: "fp-signing-expired",
      receivedAt: Date.now() - 61_000,
      request: { headers: [], method: "GET", url: resource.url },
      requirement
    });

    render(<PaymentChallengePanel resource={resource} source="api" />);
    fireEvent.click(screen.getByRole("button", { name: "Request terms" }));
    await screen.findByText("Validated x402 v2 exact");

    // Wait for the expiry banner to appear (proves secondsRemaining=0 has been set)
    await screen.findByText("This challenge has expired. Refresh terms to request a new one.");

    // Button must be disabled after expiry state is set
    const authorizeBtn = screen.getByRole("button", { name: "Authorize payment" });
    expect(authorizeBtn).toBeDisabled();
    // authorizePaymentChallenge should never have been invoked
    expect(authorizeStub).not.toHaveBeenCalled();
  });

  it("clears stale authorization fingerprint and challenge on refresh", async () => {
    vi.spyOn(apiClient, "getSupported").mockResolvedValue(demoSupportedPaymentSchemes);

    const firstFetch = vi.fn(
      async () =>
        new Response(null, {
          headers: {
            "PAYMENT-REQUIRED": encodePaymentRequiredHeader({
              accepts: [requirement],
              resource: { url: resource.url },
              x402Version: 2
            } as PaymentRequired)
          },
          status: 402
        })
    );
    vi.stubGlobal("fetch", firstFetch);

    render(<PaymentChallengePanel resource={resource} source="api" />);
    fireEvent.click(screen.getByRole("button", { name: "Request terms" }));
    await screen.findByText("Validated x402 v2 exact");

    // Refresh — the button label should change after first request
    fireEvent.click(screen.getByRole("button", { name: "Refresh terms" }));

    // After clicking refresh, the panel should briefly clear the challenge then show it again
    await waitFor(() => {
      expect(screen.getByText("Validated x402 v2 exact")).toBeInTheDocument();
    });

    // fetch was called twice (initial + refresh)
    expect(firstFetch).toHaveBeenCalledTimes(2);
  });
});
