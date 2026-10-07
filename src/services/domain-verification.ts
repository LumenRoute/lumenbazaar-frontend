import { apiClient, type LumenBazaarApiClient } from "@/services/api/client";
import type { VerifyDomainResult } from "@/services/api/schemas";
import { isDemoMode, type RuntimeEnvironment } from "@/config/runtime";

import { findDemoSeller } from "@/fixtures/lumenbazaar";
import { currentRuntimeMode } from "@/services/runtime-mode";

type DomainVerificationClient = Pick<
  LumenBazaarApiClient,
  "requestDomainChallenge" | "submitDomainVerification"
>;

export type DomainVerificationMethod = VerifyDomainResult["method"];

export type DomainVerificationFailure = {
  code: "SELLER_DOMAIN_UNVERIFIED" | "SELLER_NOT_FOUND";
  message: string;
};

export async function requestDomainChallenge(
  sellerId: string,
  method: DomainVerificationMethod,
  client: DomainVerificationClient = apiClient,
  mode: RuntimeEnvironment = currentRuntimeMode()
): Promise<VerifyDomainResult> {
  if (isDemoMode(mode)) {
    return createDemoChallenge(sellerId, method);
  }

  return client.requestDomainChallenge(sellerId, method);
}

export async function submitDomainVerification(
  sellerId: string,
  evidence: string,
  method: DomainVerificationMethod,
  client: DomainVerificationClient = apiClient,
  mode: RuntimeEnvironment = currentRuntimeMode()
): Promise<VerifyDomainResult> {
  if (isDemoMode(mode)) {
    const challenge = createDemoChallenge(sellerId, method);

    return {
      ...challenge,
      domainVerifiedAt: evidence.includes(challenge.challenge) ? new Date(0).toISOString() : null,
      verified: evidence.includes(challenge.challenge)
    };
  }

  return client.submitDomainVerification(sellerId, evidence, method);
}

export function failureForVerification(
  result: VerifyDomainResult
): DomainVerificationFailure | null {
  if (result.verified) {
    return null;
  }

  return {
    code: "SELLER_DOMAIN_UNVERIFIED",
    message: `Expected evidence containing ${result.challenge}.`
  };
}

function createDemoChallenge(
  sellerId: string,
  method: DomainVerificationMethod
): VerifyDomainResult {
  const seller = findDemoSeller(sellerId);

  if (seller === undefined) {
    throw new Error("SELLER_NOT_FOUND");
  }

  const challengeToken = `lumenbazaar-local-${seller.id}`;

  return {
    challenge: `lumenbazaar-domain-verification=${challengeToken}`,
    challengeToken,
    domain: seller.domain,
    domainVerifiedAt: seller.domainVerifiedAt,
    method,
    sellerId: seller.id,
    verified: seller.domainVerifiedAt !== null
  };
}
