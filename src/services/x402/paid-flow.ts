import { z } from "zod";

import { ApiClientError, apiClient, type LumenBazaarApiClient } from "@/services/api/client";
import {
  paymentPayloadSchema,
  type PaymentVerification,
  type Receipt,
  type Settlement
} from "@/services/api/schemas";

import type { SignedPaymentAuthorization } from "./authorization";
import type { ValidatedPaymentChallenge } from "./challenge";

export type PaidFlowState =
  | "verifying"
  | "verified"
  | "calling"
  | "submitting"
  | "pending"
  | "confirmed"
  | "rejected"
  | "indeterminate";

export const paidFlowStateLabels: Record<PaidFlowState, string> = {
  calling: "Calling paid resource",
  confirmed: "Confirmed",
  indeterminate: "Outcome unknown",
  pending: "Pending finality",
  rejected: "Rejected",
  submitting: "Submitting settlement",
  verified: "Payment verified",
  verifying: "Verifying payment"
};

export type PaidResourceResponse = {
  body: unknown;
  contentType: string;
  status: number;
};

export type PaidFlowOutcome = {
  message: string;
  paidResponse?: PaidResourceResponse;
  receipt?: Receipt;
  settlement?: Settlement;
  state: "confirmed" | "indeterminate" | "pending" | "rejected";
  transactionHash?: string;
};

type PaidFlowClient = Pick<LumenBazaarApiClient, "getReceipt" | "settlePayment" | "verifyPayment">;

type StorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;

type ExecutePaidFlowInput = {
  authorization: SignedPaymentAuthorization;
  challenge: ValidatedPaymentChallenge;
  client?: PaidFlowClient;
  fetchImpl?: typeof fetch;
  onState?: (state: PaidFlowState) => void;
  resourceId: string;
  storage?: StorageLike | null;
  timeoutMs?: number;
};

type RecoverPaidFlowInput = {
  client?: Pick<LumenBazaarApiClient, "getReceipt">;
  resourceId: string;
  storage?: StorageLike | null;
  timeoutMs?: number;
};

const recoverySchema = z.object({
  correlationId: z.string().min(1),
  network: z.literal("stellar:testnet"),
  paymentAttemptId: z.string().min(1),
  receiptId: z.string().min(1).optional(),
  resourceId: z.string().min(1),
  stage: z.enum(["verified", "submitted"]),
  transactionHash: z.string().min(1).optional(),
  updatedAt: z.string().datetime()
});

type RecoveryRecord = z.infer<typeof recoverySchema>;

export function createPaidFlowCoordinator() {
  const active = new Map<string, Promise<PaidFlowOutcome>>();
  const completed = new Map<string, PaidFlowOutcome>();

  return {
    execute(input: ExecutePaidFlowInput) {
      const key = `${input.authorization.challengeFingerprint}:${input.authorization.account}:${input.authorization.authorizedAt}`;
      const prior = completed.get(key);
      if (prior !== undefined) return Promise.resolve(prior);
      const pending = active.get(key);
      if (pending !== undefined) return pending;

      const task = executePaidFlow(input)
        .then((outcome) => {
          completed.set(key, outcome);
          return outcome;
        })
        .finally(() => active.delete(key));
      active.set(key, task);
      return task;
    },
    recover(input: RecoverPaidFlowInput) {
      return recoverPaidFlow(input);
    }
  };
}

export const paidFlowCoordinator = createPaidFlowCoordinator();

async function executePaidFlow(input: ExecutePaidFlowInput): Promise<PaidFlowOutcome> {
  const client = input.client ?? apiClient;
  const timeoutMs = input.timeoutMs ?? 30_000;
  const storage = input.storage === undefined ? browserSessionStorage() : input.storage;
  const paymentRequest = paymentPayloadSchema.parse({
    paymentPayload: input.authorization.payload,
    paymentRequirements: input.challenge.requirement,
    x402Version: 2
  });

  input.onState?.("verifying");
  let verification: PaymentVerification;
  try {
    verification = await withTimeout(client.verifyPayment(paymentRequest), timeoutMs);
  } catch (error) {
    const outcome = uncertainOutcome(
      error,
      "Payment verification did not return a definitive result."
    );
    if (isDefinitiveApiRejection(error)) {
      input.onState?.("rejected");
      return { ...outcome, state: "rejected" };
    }
    input.onState?.("indeterminate");
    return outcome;
  }
  const verificationEvidence = verification.extra?.lumenbazaar;
  if (!verification.isValid) {
    input.onState?.("rejected");
    return {
      message: verification.invalidMessage ?? "The backend rejected the payment authorization.",
      state: "rejected"
    };
  }
  if (verificationEvidence === undefined) {
    input.onState?.("indeterminate");
    return {
      message: "Verification succeeded without a recoverable payment attempt identifier.",
      state: "indeterminate"
    };
  }

  const recovery: RecoveryRecord = {
    correlationId: verificationEvidence.correlationId,
    network: "stellar:testnet",
    paymentAttemptId: verificationEvidence.paymentAttemptId,
    resourceId: input.resourceId,
    stage: "verified",
    updatedAt: new Date().toISOString()
  };
  saveRecovery(storage, recovery);
  input.onState?.("verified");

  input.onState?.("calling");
  let paidResponse: PaidResourceResponse;
  try {
    paidResponse = await callPaidResource(
      input.challenge,
      input.authorization.header,
      input.fetchImpl ?? fetch,
      timeoutMs
    );
  } catch (error) {
    input.onState?.("indeterminate");
    return uncertainOutcome(error, "The paid resource request has an unknown outcome.");
  }
  if (paidResponse.status < 200 || paidResponse.status >= 300) {
    clearRecovery(storage, input.resourceId);
    input.onState?.("rejected");
    return {
      message:
        paidResponse.status === 402
          ? "The paid resource rejected the payment authorization."
          : `The paid resource returned HTTP ${paidResponse.status}.`,
      state: "rejected"
    };
  }

  input.onState?.("submitting");
  let settlement: Settlement;
  try {
    settlement = await withTimeout(client.settlePayment(paymentRequest), timeoutMs);
  } catch (error) {
    const explicitFailure = isExplicitSettlementFailure(error);
    if (explicitFailure) clearRecovery(storage, input.resourceId);
    input.onState?.(explicitFailure ? "rejected" : "indeterminate");
    const outcome = uncertainOutcome(error, "Settlement did not return a definitive result.");
    return explicitFailure
      ? { ...outcome, paidResponse, state: "rejected" }
      : { ...outcome, paidResponse };
  }
  const settlementEvidence = settlement.extra?.lumenbazaar;
  if (!settlement.success || settlementEvidence === undefined) {
    clearRecovery(storage, input.resourceId);
    input.onState?.("rejected");
    return {
      message: settlement.errorMessage ?? "The backend rejected settlement.",
      paidResponse,
      settlement,
      state: "rejected"
    };
  }
  if (
    settlementEvidence.paymentAttemptId !== verificationEvidence.paymentAttemptId ||
    settlementEvidence.correlationId !== verificationEvidence.correlationId ||
    settlementEvidence.transactionHash !== settlement.transaction
  ) {
    input.onState?.("indeterminate");
    return {
      message: "Settlement evidence did not match the verified payment attempt.",
      paidResponse,
      settlement,
      state: "indeterminate"
    };
  }

  const submittedRecovery: RecoveryRecord = {
    ...recovery,
    receiptId: settlementEvidence.receiptId,
    stage: "submitted",
    transactionHash: settlement.transaction,
    updatedAt: new Date().toISOString()
  };
  saveRecovery(storage, submittedRecovery);
  input.onState?.("pending");

  let receipt: Receipt;
  try {
    receipt = await withTimeout(client.getReceipt(settlementEvidence.receiptId), timeoutMs);
  } catch {
    return {
      message: "Settlement was submitted; receipt finality is not available yet.",
      paidResponse,
      settlement,
      state: "pending",
      transactionHash: settlement.transaction
    };
  }

  return outcomeFromReceipt(receipt, submittedRecovery, paidResponse, settlement, input.onState);
}

async function recoverPaidFlow(input: RecoverPaidFlowInput): Promise<PaidFlowOutcome | undefined> {
  const storage = input.storage === undefined ? browserSessionStorage() : input.storage;
  const recovery = loadRecovery(storage, input.resourceId);
  if (recovery === undefined) return undefined;
  if (recovery.receiptId === undefined) {
    return {
      message:
        "A verified payment attempt is unresolved. Do not authorize another payment until its outcome is reconciled.",
      state: "indeterminate"
    };
  }

  try {
    const receipt = await withTimeout(
      (input.client ?? apiClient).getReceipt(recovery.receiptId),
      input.timeoutMs ?? 30_000
    );
    return outcomeFromReceipt(receipt, recovery);
  } catch {
    return {
      message: "A submitted payment is awaiting a recoverable receipt.",
      state: "pending",
      transactionHash: recovery.transactionHash
    };
  }
}

async function callPaidResource(
  challenge: ValidatedPaymentChallenge,
  signatureHeader: string,
  fetchImpl: typeof fetch,
  timeoutMs: number
) {
  const headers = new Headers(challenge.request.headers.map(([name, value]) => [name, value]));
  headers.set("PAYMENT-SIGNATURE", signatureHeader);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(challenge.request.url, {
      body: challenge.request.body,
      cache: "no-store",
      credentials: "omit",
      headers,
      method: challenge.request.method,
      redirect: "error",
      signal: controller.signal
    });
    return {
      body: await readResponseBody(response),
      contentType: response.headers.get("content-type") ?? "application/octet-stream",
      status: response.status
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function readResponseBody(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return (await response.json()) as unknown;
    } catch {
      return null;
    }
  }
  return response.text();
}

function outcomeFromReceipt(
  receipt: Receipt,
  recovery: RecoveryRecord,
  paidResponse?: PaidResourceResponse,
  settlement?: Settlement,
  onState?: (state: PaidFlowState) => void
): PaidFlowOutcome {
  if (
    receipt.id !== recovery.receiptId ||
    receipt.paymentAttemptId !== recovery.paymentAttemptId ||
    receipt.correlationId !== recovery.correlationId ||
    receipt.network !== recovery.network ||
    (receipt.resourceId !== null && receipt.resourceId !== recovery.resourceId) ||
    (receipt.transactionHash !== null &&
      recovery.transactionHash !== undefined &&
      receipt.transactionHash !== recovery.transactionHash)
  ) {
    onState?.("indeterminate");
    return {
      message: "Receipt evidence did not match the submitted payment.",
      ...(paidResponse === undefined ? {} : { paidResponse }),
      receipt,
      ...(settlement === undefined ? {} : { settlement }),
      state: "indeterminate"
    };
  }
  if (receipt.status === "failed") {
    onState?.("rejected");
    return {
      message: receipt.failureReason ?? "Settlement failed.",
      ...(paidResponse === undefined ? {} : { paidResponse }),
      receipt,
      ...(settlement === undefined ? {} : { settlement }),
      state: "rejected",
      ...(receipt.transactionHash === null ? {} : { transactionHash: receipt.transactionHash })
    };
  }
  if (
    receipt.status !== "finalized" ||
    receipt.transactionHash === null ||
    receipt.ledger === null
  ) {
    onState?.("pending");
    return {
      message: "Settlement is pending durable finality.",
      ...(paidResponse === undefined ? {} : { paidResponse }),
      receipt,
      ...(settlement === undefined ? {} : { settlement }),
      state: "pending",
      transactionHash: receipt.transactionHash ?? recovery.transactionHash
    };
  }

  onState?.("confirmed");
  return {
    message: "Payment settled with a durable receipt.",
    ...(paidResponse === undefined ? {} : { paidResponse }),
    receipt,
    ...(settlement === undefined ? {} : { settlement }),
    state: "confirmed",
    transactionHash: receipt.transactionHash
  };
}

function uncertainOutcome(error: unknown, fallback: string): PaidFlowOutcome {
  return {
    message: error instanceof ApiClientError ? error.message : fallback,
    state: "indeterminate"
  };
}

function isExplicitSettlementFailure(error: unknown) {
  return (
    error instanceof ApiClientError &&
    error.code === "SETTLEMENT_FAILED" &&
    error.details?.status !== "timed_out"
  );
}

function isDefinitiveApiRejection(error: unknown) {
  return (
    error instanceof ApiClientError &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 408 &&
    error.status !== 429
  );
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("request timed out")), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      }
    );
  });
}

function recoveryKey(resourceId: string) {
  return `lumenbazaar:payment-recovery:${resourceId}`;
}

function saveRecovery(storage: StorageLike | null, recovery: RecoveryRecord) {
  storage?.setItem(recoveryKey(recovery.resourceId), JSON.stringify(recovery));
}

function clearRecovery(storage: StorageLike | null, resourceId: string) {
  storage?.removeItem(recoveryKey(resourceId));
}

function loadRecovery(storage: StorageLike | null, resourceId: string) {
  const value = storage?.getItem(recoveryKey(resourceId));
  if (value === undefined || value === null) return undefined;
  try {
    const parsed = recoverySchema.safeParse(JSON.parse(value));
    if (parsed.success && parsed.data.resourceId === resourceId) return parsed.data;
  } catch {
    // Invalid recovery metadata is discarded below.
  }
  storage?.removeItem(recoveryKey(resourceId));
  return undefined;
}

function browserSessionStorage(): StorageLike | null {
  return typeof window === "undefined" ? null : window.sessionStorage;
}
