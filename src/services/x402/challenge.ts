import { decodePaymentRequiredHeader } from "@x402/core/http";
import { PaymentRequiredV2Schema } from "@x402/core/schemas";

import type { NetworkId } from "@/config/networks";
import {
  paymentRequiredV2Schema,
  type ExactPaymentRequirements,
  type PaymentRequiredV2,
  type Resource,
  type SupportedPaymentSchemes
} from "@/services/api/schemas";

export const paymentRequiredHeader = "PAYMENT-REQUIRED";

export type ChallengeErrorCode =
  | "CHALLENGE_CHANGED"
  | "CHALLENGE_EXPIRED"
  | "CHALLENGE_MALFORMED"
  | "CHALLENGE_MISMATCH"
  | "CHALLENGE_MISSING"
  | "CHALLENGE_NOT_REQUIRED"
  | "CHALLENGE_REQUEST_FAILED"
  | "CHALLENGE_UNSUPPORTED";

export class ChallengeError extends Error {
  readonly code: ChallengeErrorCode;

  constructor(code: ChallengeErrorCode, message: string) {
    super(message);
    this.name = "ChallengeError";
    this.code = code;
  }
}

export type PreservedPaidRequest = {
  body?: string;
  headers: ReadonlyArray<readonly [string, string]>;
  method: "GET" | "POST";
  url: string;
};

export type ExpectedChallengeTerms = {
  amount: string;
  asset: string;
  network: NetworkId;
  payTo: string;
  resourceUrl: string;
};

export type ValidatedPaymentChallenge = {
  challenge: PaymentRequiredV2;
  expiresAt: number;
  fingerprint: string;
  receivedAt: number;
  request: PreservedPaidRequest;
  requirement: ExactPaymentRequirements;
};

type RequestChallengeOptions = {
  fetchImpl?: typeof fetch;
  now?: () => number;
  previousFingerprint?: string;
};

export async function requestPaymentChallenge(
  request: PreservedPaidRequest,
  expected: ExpectedChallengeTerms,
  options: RequestChallengeOptions = {}
): Promise<ValidatedPaymentChallenge> {
  const preservedRequest = preserveUnpaidRequest(request);
  if (preservedRequest.url !== canonicalUrl(expected.resourceUrl)) {
    throw new ChallengeError(
      "CHALLENGE_MISMATCH",
      "The requested URL does not match the selected catalog resource."
    );
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  let response: Response;

  try {
    response = await fetchImpl(preservedRequest.url, {
      body: preservedRequest.body,
      cache: "no-store",
      credentials: "omit",
      headers: Object.fromEntries(preservedRequest.headers),
      method: preservedRequest.method,
      redirect: "error"
    });
  } catch {
    throw new ChallengeError(
      "CHALLENGE_REQUEST_FAILED",
      "The paid resource could not be reached. No payment was authorized."
    );
  }

  const receivedAt = (options.now ?? Date.now)();
  if (response.status !== 402) {
    throw new ChallengeError(
      response.ok ? "CHALLENGE_NOT_REQUIRED" : "CHALLENGE_REQUEST_FAILED",
      response.ok
        ? "The resource did not request payment."
        : `The resource returned HTTP ${response.status} instead of a payment challenge.`
    );
  }

  const encoded = response.headers.get(paymentRequiredHeader);
  if (encoded === null || encoded.trim().length === 0) {
    throw new ChallengeError(
      "CHALLENGE_MISSING",
      "The resource returned HTTP 402 without a PAYMENT-REQUIRED header."
    );
  }

  const challenge = decodeChallenge(encoded);
  const requirement = selectExactRequirement(challenge, expected.network);
  validateCriticalTerms(challenge, requirement, expected);

  const fingerprint = challengeFingerprint(challenge.resource.url, requirement);
  if (options.previousFingerprint !== undefined && options.previousFingerprint !== fingerprint) {
    throw new ChallengeError(
      "CHALLENGE_CHANGED",
      "The resource changed its payment terms. Review a fresh challenge before continuing."
    );
  }

  const validated = {
    challenge,
    expiresAt: receivedAt + requirement.maxTimeoutSeconds * 1_000,
    fingerprint,
    receivedAt,
    request: preservedRequest,
    requirement
  };
  assertChallengeFresh(validated, receivedAt);
  return validated;
}

export function expectedTermsForResource(
  resource: Resource,
  supported: SupportedPaymentSchemes,
  selectedNetwork: NetworkId
): ExpectedChallengeTerms {
  if (resource.network !== selectedNetwork) {
    throw new ChallengeError(
      "CHALLENGE_MISMATCH",
      `The resource network does not match the selected network ${selectedNetwork}.`
    );
  }

  const kind = supported.kinds.find(
    (candidate) =>
      candidate.x402Version === 2 &&
      candidate.scheme === "exact" &&
      candidate.network === selectedNetwork
  );
  const asset = kind?.extra?.assets?.find(
    (candidate) =>
      candidate.code === resource.assetCode && candidate.issuer === resource.assetIssuer
  );

  if (asset?.contractId === undefined) {
    throw new ChallengeError(
      "CHALLENGE_UNSUPPORTED",
      "The backend does not advertise this resource asset for x402 v2 exact payments."
    );
  }

  return {
    amount: toAtomicAmount(resource.amount, asset.decimals),
    asset: asset.contractId,
    network: selectedNetwork,
    payTo: resource.payTo,
    resourceUrl: resource.url
  };
}

export function assertChallengeFresh(
  challenge: Pick<ValidatedPaymentChallenge, "expiresAt">,
  now = Date.now()
) {
  if (now >= challenge.expiresAt) {
    throw new ChallengeError(
      "CHALLENGE_EXPIRED",
      "The payment challenge expired. Request fresh terms before continuing."
    );
  }
}

export function isChallengeExpired(
  challenge: Pick<ValidatedPaymentChallenge, "expiresAt">,
  now = Date.now()
) {
  return now >= challenge.expiresAt;
}

function decodeChallenge(encoded: string): PaymentRequiredV2 {
  try {
    const decoded = decodePaymentRequiredHeader(encoded);
    const official = PaymentRequiredV2Schema.parse(decoded);
    const exactAccepts = official.accepts.filter((requirement) => requirement.scheme === "exact");
    if (exactAccepts.length === 0) {
      throw new ChallengeError(
        "CHALLENGE_UNSUPPORTED",
        "The resource does not offer an x402 v2 exact payment option."
      );
    }
    return paymentRequiredV2Schema.parse({ ...official, accepts: exactAccepts });
  } catch (error) {
    if (error instanceof ChallengeError) throw error;
    throw new ChallengeError(
      "CHALLENGE_MALFORMED",
      "The PAYMENT-REQUIRED header is not a valid official x402 v2 challenge."
    );
  }
}

function selectExactRequirement(challenge: PaymentRequiredV2, network: NetworkId) {
  const exact = challenge.accepts.find(
    (requirement) => requirement.scheme === "exact" && requirement.network === network
  );
  if (exact !== undefined) return exact;

  throw new ChallengeError(
    "CHALLENGE_UNSUPPORTED",
    `The resource does not offer x402 v2 exact payment on ${network}.`
  );
}

function validateCriticalTerms(
  challenge: PaymentRequiredV2,
  requirement: ExactPaymentRequirements,
  expected: ExpectedChallengeTerms
) {
  const mismatches: string[] = [];
  if (requirement.network !== expected.network) mismatches.push("network");
  if (requirement.asset !== expected.asset) mismatches.push("asset");
  if (requirement.amount !== expected.amount) mismatches.push("amount");
  if (requirement.payTo !== expected.payTo) mismatches.push("recipient");
  if (canonicalUrl(challenge.resource.url) !== canonicalUrl(expected.resourceUrl)) {
    mismatches.push("resource");
  }

  if (mismatches.length > 0) {
    throw new ChallengeError(
      "CHALLENGE_MISMATCH",
      `The challenge does not match the catalog for: ${mismatches.join(", ")}.`
    );
  }
}

function preserveUnpaidRequest(request: PreservedPaidRequest): PreservedPaidRequest {
  const url = canonicalUrl(request.url);
  const headers = new Headers(request.headers.map(([name, value]) => [name, value]));
  if (headers.has("PAYMENT-SIGNATURE")) {
    throw new ChallengeError(
      "CHALLENGE_REQUEST_FAILED",
      "A challenge request must not include a payment signature."
    );
  }

  return {
    ...(request.body === undefined ? {} : { body: request.body }),
    headers: [...headers.entries()].map(([name, value]) => [name, value] as const),
    method: request.method,
    url
  };
}

function challengeFingerprint(resourceUrl: string, requirement: ExactPaymentRequirements) {
  return JSON.stringify({
    amount: requirement.amount,
    asset: requirement.asset,
    maxTimeoutSeconds: requirement.maxTimeoutSeconds,
    network: requirement.network,
    payTo: requirement.payTo,
    resourceUrl: canonicalUrl(resourceUrl),
    scheme: requirement.scheme
  });
}

function canonicalUrl(value: string) {
  try {
    return new URL(value).toString();
  } catch {
    throw new ChallengeError("CHALLENGE_MALFORMED", "The paid resource URL is invalid.");
  }
}

function toAtomicAmount(value: string, decimals: number) {
  if (!Number.isInteger(decimals) || decimals < 0 || !/^\d+(?:\.\d+)?$/.test(value)) {
    throw new ChallengeError("CHALLENGE_UNSUPPORTED", "The catalog amount cannot be validated.");
  }

  const [whole = "0", fraction = ""] = value.split(".");
  const discarded = fraction.slice(decimals);
  if (/[^0]/.test(discarded)) {
    throw new ChallengeError(
      "CHALLENGE_UNSUPPORTED",
      "The catalog amount exceeds the supported asset precision."
    );
  }

  const atomic = `${whole}${fraction.slice(0, decimals).padEnd(decimals, "0")}`.replace(/^0+/, "");
  if (atomic.length === 0) {
    throw new ChallengeError("CHALLENGE_UNSUPPORTED", "The catalog amount must be positive.");
  }
  return atomic;
}
