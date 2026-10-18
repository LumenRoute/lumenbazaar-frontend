import { describe, expect, it, vi } from "vitest";

import type { VerifyDomainResult } from "@/services/api/schemas";

import {
  challengeSecondsRemaining,
  failureForVerification,
  isChallengeExpired,
  pollDomainVerification,
  requestDomainChallenge,
  requestReplacementChallenge,
  submitDomainVerification,
  type DomainVerificationMethod
} from "./domain-verification";

const START = Date.parse("2026-10-18T09:00:00.000Z");

describe("domain verification service", () => {
  it("creates a local challenge only in explicit demo mode", async () => {
    const challenge = await requestDomainChallenge(
      "seller_vector_rag",
      "dns",
      {
        requestDomainChallenge: async () => Promise.reject(new Error("offline")),
        submitDomainVerification: async () => Promise.reject(new Error("offline"))
      },
      "demo",
      { now: () => START }
    );

    expect(challenge.method).toBe("dns");
    expect(challenge.challenge).toContain("lumenbazaar-domain-verification=");
    expect(challenge.issuedAt).toBe("2026-10-18T09:00:00.000Z");
    expect(challenge.expiresAt).toBe("2026-10-18T09:10:00.000Z");
  });

  it("marks local evidence as verified only when it contains the challenge", async () => {
    const result = await submitDomainVerification(
      "seller_vector_rag",
      "lumenbazaar-domain-verification=lumenbazaar-local-seller_vector_rag",
      "well-known",
      {
        requestDomainChallenge: async () => Promise.reject(new Error("offline")),
        submitDomainVerification: async () => Promise.reject(new Error("offline"))
      },
      "demo"
    );

    expect(result.verified).toBe(true);
    expect(failureForVerification(result)).toBeNull();
  });

  it("returns a stable failure code for unverifiable well-known evidence", async () => {
    const result = await submitDomainVerification(
      "seller_vector_rag",
      "wrong-token",
      "well-known",
      {
        requestDomainChallenge: async () => Promise.reject(new Error("offline")),
        submitDomainVerification: async () => Promise.reject(new Error("offline"))
      },
      "demo"
    );

    expect(failureForVerification(result)).toMatchObject({
      code: "SELLER_DOMAIN_UNVERIFIED",
      retryable: false
    });
  });

  it("distinguishes DNS propagation from an invalid well-known proof", async () => {
    const dns = await submitDomainVerification(
      "seller_vector_rag",
      "wrong-token",
      "dns",
      {
        requestDomainChallenge: async () => Promise.reject(new Error("offline")),
        submitDomainVerification: async () => Promise.reject(new Error("offline"))
      },
      "demo"
    );

    expect(failureForVerification(dns)).toMatchObject({
      code: "DOMAIN_DNS_PROPAGATION_PENDING",
      retryable: true
    });
  });

  it("expires challenges deterministically from the client clock", async () => {
    const challenge = await requestDomainChallenge(
      "seller_vector_rag",
      "well-known",
      {
        requestDomainChallenge: async () => Promise.reject(new Error("offline")),
        submitDomainVerification: async () => Promise.reject(new Error("offline"))
      },
      "demo",
      { now: () => START }
    );

    expect(challengeSecondsRemaining(challenge, START)).toBe(600);
    expect(challengeSecondsRemaining(challenge, START + 540_000)).toBe(60);
    expect(isChallengeExpired(challenge, START + 599_999)).toBe(false);
    expect(isChallengeExpired(challenge, START + 600_000)).toBe(true);
  });

  it("replaces a challenge with a fresh expiry window", async () => {
    const now = () => START + 300_000;
    const replacement = await requestReplacementChallenge({
      method: "well-known",
      mode: "demo",
      now,
      sellerId: "seller_vector_rag"
    });

    expect(replacement.issuedAt).toBe("2026-10-18T09:05:00.000Z");
    expect(replacement.expiresAt).toBe("2026-10-18T09:15:00.000Z");
  });

  it("polls with deterministic backoff and stops on success", async () => {
    const delays: number[] = [];
    let nowMs = START;
    const submit = vi
      .fn<() => Promise<VerifyDomainResult>>()
      .mockResolvedValueOnce(result({ verified: false }))
      .mockResolvedValueOnce(result({ verified: true }));

    const poll = await pollDomainVerification({
      challenge: await demoChallenge(),
      client: {
        requestDomainChallenge: vi.fn(),
        submitDomainVerification: submit
      },
      evidence: "proof",
      method: "well-known",
      mode: "testnet",
      now: () => nowMs,
      schedule: { initialDelayMs: 500, maxAttempts: 4, maxElapsedMs: 60_000 },
      sellerId: "seller_vector_rag",
      sleep: async (delayMs) => {
        delays.push(delayMs);
        nowMs += delayMs;
        return true;
      }
    });

    expect(poll).toMatchObject({ attempts: 2, failure: null, status: "verified" });
    expect(submit).toHaveBeenCalledTimes(2);
    expect(delays).toEqual([500]);
  });

  it("stops at the configured retry limit with a DNS-specific failure", async () => {
    let nowMs = START;
    const delays: number[] = [];

    const poll = await pollDomainVerification({
      challenge: await demoChallenge({ method: "dns" }),
      evidence: "wrong-token",
      method: "dns",
      mode: "demo",
      now: () => nowMs,
      schedule: { initialDelayMs: 500, maxAttempts: 3, maxElapsedMs: 60_000 },
      sellerId: "seller_vector_rag",
      sleep: async (delayMs) => {
        delays.push(delayMs);
        nowMs += delayMs;
        return true;
      }
    });

    expect(poll).toMatchObject({
      attempts: 3,
      failure: { code: "DOMAIN_DNS_PROPAGATION_PENDING" },
      status: "exhausted"
    });
    expect(delays).toEqual([500, 1_000]);
  });

  it("stops polling when the challenge expires mid-flight", async () => {
    let nowMs = START;
    const poll = await pollDomainVerification({
      challenge: await demoChallenge({ method: "dns" }),
      evidence: "wrong-token",
      method: "dns",
      mode: "demo",
      now: () => nowMs,
      schedule: { initialDelayMs: 600_000, maxAttempts: 5, maxElapsedMs: 3_600_000 },
      sellerId: "seller_vector_rag",
      sleep: async (delayMs) => {
        nowMs += delayMs;
        return true;
      }
    });

    expect(poll).toMatchObject({
      failure: { code: "DOMAIN_CHALLENGE_EXPIRED", retryable: false },
      status: "expired"
    });
  });

  it("cancels polling when the view unmounts", async () => {
    const controller = new AbortController();
    controller.abort();

    const poll = await pollDomainVerification({
      challenge: await demoChallenge(),
      evidence: "wrong-token",
      method: "well-known",
      mode: "demo",
      schedule: { initialDelayMs: 10, maxAttempts: 3, maxElapsedMs: 1_000 },
      sellerId: "seller_vector_rag",
      signal: controller.signal
    });

    expect(poll).toMatchObject({ attempts: 0, status: "cancelled" });
  });

  it("propagates backend unavailability outside demo mode", async () => {
    await expect(
      requestDomainChallenge(
        "seller_vector_rag",
        "dns",
        {
          requestDomainChallenge: async () => Promise.reject(new Error("offline")),
          submitDomainVerification: async () => Promise.reject(new Error("offline"))
        },
        "local"
      )
    ).rejects.toThrow("offline");
  });
});

async function demoChallenge({
  method = "well-known"
}: { method?: DomainVerificationMethod } = {}) {
  return requestDomainChallenge(
    "seller_vector_rag",
    method,
    {
      requestDomainChallenge: async () => Promise.reject(new Error("offline")),
      submitDomainVerification: async () => Promise.reject(new Error("offline"))
    },
    "demo",
    { now: () => START }
  );
}

function result({ verified }: { verified: boolean }): VerifyDomainResult {
  return {
    challenge: "lumenbazaar-domain-verification=lumenbazaar-local-seller_vector_rag",
    challengeToken: "lumenbazaar-local-seller_vector_rag",
    domain: "rag.lumenbazaar.dev",
    domainVerifiedAt: verified ? "2026-10-18T09:00:00.000Z" : null,
    method: "well-known",
    sellerId: "seller_vector_rag",
    verified
  };
}
