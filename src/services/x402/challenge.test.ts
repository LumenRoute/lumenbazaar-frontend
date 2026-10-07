import { encodePaymentRequiredHeader } from "@x402/core/http";
import type { PaymentRequired } from "@x402/core/types";
import { describe, expect, it, vi } from "vitest";

import type { Resource, SupportedPaymentSchemes } from "@/services/api/schemas";

import {
  assertChallengeFresh,
  ChallengeError,
  expectedTermsForResource,
  requestPaymentChallenge,
  type ExpectedChallengeTerms
} from "./challenge";

const resourceUrl = "https://seller.example/weather?city=Lagos";
const requirement = {
  amount: "500000",
  asset: "CB256KDRXDO2FYJN3YBYZE5KCU46WIIE67DRP5T7HI45DRH2GM6YOJFS",
  extra: {
    assetCode: "USDC",
    assetIssuer: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
  },
  maxTimeoutSeconds: 60,
  network: "stellar:testnet",
  payTo: "GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE",
  scheme: "exact"
} as const;
const expected: ExpectedChallengeTerms = {
  amount: requirement.amount,
  asset: requirement.asset,
  network: requirement.network,
  payTo: requirement.payTo,
  resourceUrl
};
const deployedCompatibleChallenge = {
  accepts: [requirement],
  resource: {
    description: "Current weather",
    mimeType: "application/json",
    url: resourceUrl
  },
  x402Version: 2 as const
};

describe("x402 v2 challenge handling", () => {
  it("decodes a backend-compatible canonical header and preserves the unpaid request", async () => {
    const result = await requestPaymentChallenge(request(), expected, {
      fetchImpl: challengeFetch(deployedCompatibleChallenge),
      now: () => 1_000
    });

    expect(result.requirement).toEqual(requirement);
    expect(result.expiresAt).toBe(61_000);
    expect(result.request).toEqual({
      headers: [["accept", "application/json"]],
      method: "GET",
      url: resourceUrl
    });
  });

  it.each([
    ["asset", { asset: "CDIFFERENT" }],
    ["amount", { amount: "500001" }],
    ["recipient", { payTo: "GDIFFERENT" }]
  ])("rejects a mutated %s", async (_field, mutation) => {
    await expectChallengeCode(
      { ...deployedCompatibleChallenge, accepts: [{ ...requirement, ...mutation }] },
      "CHALLENGE_MISMATCH"
    );
  });

  it("rejects a mutated network", async () => {
    await expectChallengeCode(
      {
        ...deployedCompatibleChallenge,
        accepts: [{ ...requirement, network: "stellar:pubnet" }]
      },
      "CHALLENGE_UNSUPPORTED"
    );
  });

  it("rejects a mutated resource URL", async () => {
    await expectChallengeCode(
      { ...deployedCompatibleChallenge, resource: { url: "https://attacker.example/weather" } },
      "CHALLENGE_MISMATCH"
    );
  });

  it("rejects unsupported schemes and versions", async () => {
    await expectChallengeCode(
      {
        ...deployedCompatibleChallenge,
        accepts: [{ ...requirement, scheme: "upto" }]
      },
      "CHALLENGE_UNSUPPORTED"
    );
    await expectChallengeCode(
      { ...deployedCompatibleChallenge, x402Version: 1 },
      "CHALLENGE_MALFORMED"
    );
  });

  it("rejects missing and malformed canonical headers", async () => {
    await expect(
      requestPaymentChallenge(request(), expected, {
        fetchImpl: vi.fn(async () => new Response(null, { status: 402 }))
      })
    ).rejects.toMatchObject({ code: "CHALLENGE_MISSING" });
    await expect(
      requestPaymentChallenge(request(), expected, {
        fetchImpl: vi.fn(
          async () =>
            new Response(null, { headers: { "PAYMENT-REQUIRED": "not-base64" }, status: 402 })
        )
      })
    ).rejects.toMatchObject({ code: "CHALLENGE_MALFORMED" });
  });

  it("detects changed and expired terms before authorization", async () => {
    const first = await requestPaymentChallenge(request(), expected, {
      fetchImpl: challengeFetch(deployedCompatibleChallenge),
      now: () => 1_000
    });
    const changed = {
      ...deployedCompatibleChallenge,
      accepts: [{ ...requirement, maxTimeoutSeconds: 90 }]
    };

    await expect(
      requestPaymentChallenge(request(), expected, {
        fetchImpl: challengeFetch(changed),
        now: () => 2_000,
        previousFingerprint: first.fingerprint
      })
    ).rejects.toMatchObject({ code: "CHALLENGE_CHANGED" });
    expect(() => assertChallengeFresh(first, first.expiresAt)).toThrowError(
      expect.objectContaining({ code: "CHALLENGE_EXPIRED" })
    );
  });

  it("derives the expected asset contract and atomic amount from supported metadata", () => {
    const resource = {
      amount: "0.0500000",
      assetCode: "USDC",
      assetIssuer: requirement.extra.assetIssuer,
      network: requirement.network,
      payTo: requirement.payTo,
      url: resourceUrl
    } as Resource;
    const supported = {
      extensions: [],
      kinds: [
        {
          extra: {
            assets: [
              {
                code: "USDC",
                contractId: requirement.asset,
                decimals: 7,
                issuer: requirement.extra.assetIssuer
              }
            ]
          },
          network: requirement.network,
          scheme: "exact",
          x402Version: 2
        }
      ],
      signers: {}
    } satisfies SupportedPaymentSchemes;

    expect(expectedTermsForResource(resource, supported, "stellar:testnet")).toEqual(expected);
    expect(() => expectedTermsForResource(resource, supported, "stellar:pubnet")).toThrowError(
      expect.objectContaining({ code: "CHALLENGE_MISMATCH" })
    );
  });

  it("never sends an existing payment signature while requesting terms", async () => {
    await expect(
      requestPaymentChallenge(
        { ...request(), headers: [["PAYMENT-SIGNATURE", "signed"]] },
        expected,
        { fetchImpl: challengeFetch(deployedCompatibleChallenge) }
      )
    ).rejects.toMatchObject({ code: "CHALLENGE_REQUEST_FAILED" });
  });

  it("does not request a URL that differs from the selected catalog resource", async () => {
    const fetchImpl = challengeFetch(deployedCompatibleChallenge);
    await expect(
      requestPaymentChallenge({ ...request(), url: "https://attacker.example/weather" }, expected, {
        fetchImpl
      })
    ).rejects.toMatchObject({ code: "CHALLENGE_MISMATCH" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

function request() {
  return {
    headers: [["Accept", "application/json"]] as const,
    method: "GET" as const,
    url: resourceUrl
  };
}

function challengeFetch(challenge: unknown) {
  return vi.fn(
    async () =>
      new Response(null, {
        headers: {
          "PAYMENT-REQUIRED": encodePaymentRequiredHeader(challenge as PaymentRequired)
        },
        status: 402
      })
  );
}

async function expectChallengeCode(challenge: unknown, code: ChallengeError["code"]) {
  await expect(
    requestPaymentChallenge(request(), expected, { fetchImpl: challengeFetch(challenge) })
  ).rejects.toMatchObject({ code });
}
