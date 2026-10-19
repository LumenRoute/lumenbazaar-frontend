import { apiClient, ApiClientError, type LumenBazaarApiClient } from "@/services/api/client";
import type { VerifyDomainResult } from "@/services/api/schemas";
import { isDemoMode, type RuntimeEnvironment } from "@/config/runtime";
import { pollWithBackoff, type PollVisibility } from "@/services/polling";

import { findDemoSeller } from "@/fixtures/lumenbazaar";
import { currentRuntimeMode } from "@/services/runtime-mode";

type DomainVerificationClient = Pick<
  LumenBazaarApiClient,
  "requestDomainChallenge" | "submitDomainVerification"
>;

export type DomainVerificationMethod = VerifyDomainResult["method"];

export const DOMAIN_CHALLENGE_TTL_MS = 10 * 60 * 1000;

export type DomainChallenge = VerifyDomainResult & {
  /** ISO timestamp for when the challenge was issued to this client. */
  issuedAt: string;
  /** ISO timestamp after which the challenge must be replaced. */
  expiresAt: string;
};

export type DomainVerificationFailureCode =
  | "SELLER_DOMAIN_UNVERIFIED"
  | "SELLER_NOT_FOUND"
  | "DOMAIN_CHALLENGE_EXPIRED"
  | "DOMAIN_DNS_PROPAGATION_PENDING";

export type DomainVerificationFailure = {
  code: DomainVerificationFailureCode;
  message: string;
  /** True when retrying the same evidence can succeed without a new challenge. */
  retryable: boolean;
};

export type DomainVerificationPollOptions = {
  challenge: DomainChallenge;
  client?: DomainVerificationClient;
  evidence: string;
  method: DomainVerificationMethod;
  mode?: RuntimeEnvironment;
  now?: () => number;
  schedule?: {
    initialDelayMs?: number;
    maxAttempts?: number;
    maxDelayMs?: number;
    maxElapsedMs?: number;
  };
  sellerId: string;
  signal?: AbortSignal;
  sleep?: (delayMs: number, signal: AbortSignal) => Promise<boolean>;
  visibility?: PollVisibility;
};

export type DomainVerificationPollResult = {
  attempts: number;
  challenge: DomainChallenge;
  failure: DomainVerificationFailure | null;
  result: VerifyDomainResult | null;
  status: "cancelled" | "exhausted" | "expired" | "failed" | "verified";
};

export async function requestDomainChallenge(
  sellerId: string,
  method: DomainVerificationMethod,
  client: DomainVerificationClient = apiClient,
  mode: RuntimeEnvironment = currentRuntimeMode(),
  { now = Date.now }: { now?: () => number } = {}
): Promise<DomainChallenge> {
  if (isDemoMode(mode)) {
    return withChallengeExpiry(createDemoChallenge(sellerId, method), now);
  }

  return withChallengeExpiry(await client.requestDomainChallenge(sellerId, method), now);
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

/**
 * Bounded verification polling.
 *
 * The pinned backend only exposes `POST /v1/sellers/{id}/verify-domain` for
 * both challenge issuance and verification, so the poll repeats that
 * verification check with exponential backoff. It never requests a new
 * challenge, so a stale proof cannot silently rotate the challenge mid-poll.
 */
export async function pollDomainVerification(
  options: DomainVerificationPollOptions
): Promise<DomainVerificationPollResult> {
  const mode = options.mode ?? currentRuntimeMode();
  const now = options.now ?? Date.now;
  let attempts = 0;
  const observed: { current: VerifyDomainResult | null } = { current: null };

  try {
    const poll = await pollWithBackoff<VerifyDomainResult>({
      check: async () => {
        attempts += 1;
        const result = await submitDomainVerification(
          options.sellerId,
          options.evidence,
          options.method,
          options.client,
          mode
        );
        observed.current = result;

        return result;
      },
      initialDelayMs: options.schedule?.initialDelayMs,
      isTerminal: (result) => result.verified || isChallengeExpired(options.challenge, now()),
      maxAttempts: options.schedule?.maxAttempts,
      maxDelayMs: options.schedule?.maxDelayMs,
      maxElapsedMs: options.schedule?.maxElapsedMs,
      now,
      signal: options.signal,
      sleep: options.sleep,
      visibility: options.visibility
    });

    if (poll.status === "cancelled") {
      return {
        attempts,
        challenge: options.challenge,
        failure: null,
        result: observed.current,
        status: "cancelled"
      };
    }

    if (observed.current?.verified === true) {
      return {
        attempts,
        challenge: options.challenge,
        failure: null,
        result: observed.current,
        status: "verified"
      };
    }

    if (isChallengeExpired(options.challenge, now())) {
      return {
        attempts,
        challenge: options.challenge,
        failure: expiredFailure(options.challenge),
        result: observed.current,
        status: "expired"
      };
    }

    return {
      attempts,
      challenge: options.challenge,
      failure: observed.current === null ? null : failureForVerification(observed.current),
      result: observed.current,
      status: "exhausted"
    };
  } catch (error) {
    return {
      attempts,
      challenge: options.challenge,
      failure: failureForError(error, options.method),
      result: observed.current,
      status: "failed"
    };
  }
}

/**
 * Requests a replacement challenge. The caller must discard the previous
 * challenge token and evidence before rendering the replacement.
 */
export async function requestReplacementChallenge({
  client,
  method,
  mode,
  now,
  sellerId
}: {
  client?: DomainVerificationClient;
  method: DomainVerificationMethod;
  mode?: RuntimeEnvironment;
  now?: () => number;
  sellerId: string;
}): Promise<DomainChallenge> {
  return requestDomainChallenge(
    sellerId,
    method,
    client ?? apiClient,
    mode ?? currentRuntimeMode(),
    now === undefined ? {} : { now }
  );
}

export function failureForVerification(
  result: VerifyDomainResult
): DomainVerificationFailure | null {
  if (result.verified) {
    return null;
  }

  if (result.method === "dns") {
    return {
      code: "DOMAIN_DNS_PROPAGATION_PENDING",
      message: `The TXT record for _lumenbazaar.${result.domain} is not visible yet. DNS propagation can take up to 48 hours; retry the same challenge.`,
      retryable: true
    };
  }

  return {
    code: "SELLER_DOMAIN_UNVERIFIED",
    message: `Expected the well-known file to contain ${result.challenge}.`,
    retryable: false
  };
}

export function challengeSecondsRemaining(challenge: DomainChallenge, now = Date.now()) {
  return Math.max(0, Math.ceil((Date.parse(challenge.expiresAt) - now) / 1_000));
}

export function isChallengeExpired(challenge: DomainChallenge, now = Date.now()) {
  return challengeSecondsRemaining(challenge, now) === 0;
}

function expiredFailure(challenge: DomainChallenge) {
  return {
    code: "DOMAIN_CHALLENGE_EXPIRED" as const,
    message: `This challenge expired at ${new Date(challenge.expiresAt).toISOString()}. Request a replacement challenge before retrying.`,
    retryable: false
  };
}

function failureForError(
  error: unknown,
  method: DomainVerificationMethod
): DomainVerificationFailure {
  if (error instanceof ApiClientError && error.code === "SELLER_NOT_FOUND") {
    return { code: "SELLER_NOT_FOUND", message: error.message, retryable: false };
  }

  if (method === "dns") {
    return {
      code: "DOMAIN_DNS_PROPAGATION_PENDING",
      message:
        error instanceof Error
          ? `Verification could not confirm the DNS TXT record: ${error.message}`
          : "Verification could not confirm the DNS TXT record yet.",
      retryable: true
    };
  }

  return {
    code: "SELLER_DOMAIN_UNVERIFIED",
    message: error instanceof Error ? error.message : "Domain verification failed.",
    retryable: true
  };
}

function withChallengeExpiry(result: VerifyDomainResult, now: () => number): DomainChallenge {
  const issuedAtMs = now();

  return {
    ...result,
    expiresAt: new Date(issuedAtMs + DOMAIN_CHALLENGE_TTL_MS).toISOString(),
    issuedAt: new Date(issuedAtMs).toISOString()
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
