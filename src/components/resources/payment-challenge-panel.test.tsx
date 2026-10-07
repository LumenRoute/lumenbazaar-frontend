import { encodePaymentRequiredHeader } from "@x402/core/http";
import type { PaymentRequired } from "@x402/core/types";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { demoResources, demoSupportedPaymentSchemes } from "@/fixtures/lumenbazaar";
import { apiClient } from "@/services/api/client";

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
});
