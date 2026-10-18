import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { DomainChallenge } from "@/services/domain-verification";

import { SellerDomainVerifier } from "./seller-domain-verifier";

const mocks = vi.hoisted(() => ({
  pollDomainVerification: vi.fn(),
  requestDomainChallenge: vi.fn(),
  requestReplacementChallenge: vi.fn()
}));
const { pollDomainVerification, requestDomainChallenge, requestReplacementChallenge } = mocks;

vi.mock("@/services/domain-verification", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/domain-verification")>();

  return {
    ...actual,
    pollDomainVerification: mocks.pollDomainVerification,
    requestDomainChallenge: mocks.requestDomainChallenge,
    requestReplacementChallenge: mocks.requestReplacementChallenge
  };
});

describe("SellerDomainVerifier", () => {
  it("renders challenge request controls", () => {
    render(<SellerDomainVerifier domain="rag.lumenbazaar.dev" sellerId="seller_vector_rag" />);

    expect(screen.getByText("Domain verification")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Request challenge/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Method")).toBeInTheDocument();
  });

  it("shows challenge expiry, DNS instructions, and a replacement action", async () => {
    requestDomainChallenge.mockResolvedValueOnce(challenge({ method: "dns" }));
    const user = userEvent.setup();
    render(<SellerDomainVerifier domain="rag.lumenbazaar.dev" sellerId="seller_vector_rag" />);

    await user.selectOptions(screen.getByLabelText("Method"), "dns");
    await user.click(screen.getByRole("button", { name: /Request challenge/i }));

    expect(await screen.findByText(/Expires in/)).toBeInTheDocument();
    expect(screen.getByText(/_lumenbazaar\.rag\.lumenbazaar\.dev/)).toBeInTheDocument();
    expect(screen.getByText(/up to 48 hours/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Replacement challenge/i })).toBeInTheDocument();
  });

  it("invalidates stale evidence when a replacement challenge is issued", async () => {
    requestDomainChallenge.mockResolvedValueOnce(challenge({ token: "stale-token" }));
    requestReplacementChallenge.mockResolvedValueOnce(
      challenge({ expiresInMs: 600_000, token: "replacement-token" })
    );
    const user = userEvent.setup();
    render(<SellerDomainVerifier domain="rag.lumenbazaar.dev" sellerId="seller_vector_rag" />);

    await user.click(screen.getByRole("button", { name: /Request challenge/i }));
    await user.type(screen.getByLabelText("Evidence"), "old-evidence");
    expect(screen.getByLabelText("Evidence")).toHaveValue("old-evidence");

    await user.click(screen.getByRole("button", { name: /Replacement challenge/i }));

    expect(await screen.findByText(/replacement-token/)).toBeInTheDocument();
    expect(screen.getByLabelText("Evidence")).toHaveValue("");
    expect(requestReplacementChallenge).toHaveBeenCalledTimes(1);
  });

  it("distinguishes DNS propagation from an invalid proof", async () => {
    requestDomainChallenge.mockResolvedValueOnce(challenge({ method: "dns" }));
    pollDomainVerification.mockResolvedValueOnce({
      attempts: 3,
      challenge: challenge({ method: "dns" }),
      failure: {
        code: "DOMAIN_DNS_PROPAGATION_PENDING",
        message: "The TXT record is not visible yet.",
        retryable: true
      },
      result: null,
      status: "exhausted"
    });
    const user = userEvent.setup();
    render(<SellerDomainVerifier domain="rag.lumenbazaar.dev" sellerId="seller_vector_rag" />);

    await user.click(screen.getByRole("button", { name: /Request challenge/i }));
    await user.type(screen.getByLabelText("Evidence"), "lumenbazaar-domain-verification=x");
    await user.click(screen.getByRole("button", { name: /Submit verification/i }));

    expect(await screen.findByText("DOMAIN_DNS_PROPAGATION_PENDING")).toBeInTheDocument();
    expect(screen.getByText("The TXT record is not visible yet.")).toBeInTheDocument();
    expect(screen.getByText(/bounded retry limit was reached/)).toBeInTheDocument();
  });
});

function challenge({
  expiresInMs = 600_000,
  method = "well-known",
  token = "lumenbazaar-local-seller_vector_rag"
}: {
  expiresInMs?: number;
  method?: DomainChallenge["method"];
  token?: string;
} = {}): DomainChallenge {
  const now = Date.now();

  return {
    challenge: `lumenbazaar-domain-verification=${token}`,
    challengeToken: token,
    domain: "rag.lumenbazaar.dev",
    domainVerifiedAt: null,
    expiresAt: new Date(now + expiresInMs).toISOString(),
    issuedAt: new Date(now).toISOString(),
    method,
    sellerId: "seller_vector_rag",
    verified: false
  };
}
