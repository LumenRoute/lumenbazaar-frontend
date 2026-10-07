import { describe, expect, it } from "vitest";

import {
  failureForVerification,
  requestDomainChallenge,
  submitDomainVerification
} from "./domain-verification";

describe("domain verification service", () => {
  it("creates a local challenge only in explicit demo mode", async () => {
    const challenge = await requestDomainChallenge(
      "seller_vector_rag",
      "dns",
      {
        requestDomainChallenge: async () => Promise.reject(new Error("offline")),
        submitDomainVerification: async () => Promise.reject(new Error("offline"))
      },
      "demo"
    );

    expect(challenge.method).toBe("dns");
    expect(challenge.challenge).toContain("lumenbazaar-domain-verification=");
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

  it("returns a stable failure code for unverifiable evidence", async () => {
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
      code: "SELLER_DOMAIN_UNVERIFIED"
    });
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
