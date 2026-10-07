import { describe, expect, it, vi } from "vitest";

import { ApiClientError } from "@/services/api/client";
import type { PaymentVerification, Receipt, Settlement } from "@/services/api/schemas";

import type { SignedPaymentAuthorization } from "./authorization";
import type { ValidatedPaymentChallenge } from "./challenge";
import { createPaidFlowCoordinator, paidFlowStateLabels } from "./paid-flow";

describe("paid resource flow", () => {
  it("verifies, retries the original request once, settles, and confirms a durable receipt", async () => {
    const storage = memoryStorage();
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("PAYMENT-SIGNATURE")).toBe("canonical-header");
      return Response.json({ forecast: "sunny" });
    });
    const client = successfulClient();
    const states: string[] = [];

    const result = await createPaidFlowCoordinator().execute({
      authorization: authorization(),
      challenge: challenge(),
      client,
      fetchImpl: fetchImpl as typeof fetch,
      onState: (state) => states.push(state),
      resourceId: "resource_weather",
      storage
    });

    expect(result).toMatchObject({
      paidResponse: { body: { forecast: "sunny" }, status: 200 },
      receipt: { id: "receipt_1", status: "finalized" },
      state: "confirmed",
      transactionHash: "tx_1"
    });
    expect(states).toEqual([
      "verifying",
      "verified",
      "calling",
      "submitting",
      "pending",
      "confirmed"
    ]);
    expect(client.settlePayment).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(storage.value()).not.toMatch(/canonical-header|signed-xdr|PAYMENT-SIGNATURE/i);
  });

  it("coalesces duplicate clicks and never starts a second settlement", async () => {
    const coordinator = createPaidFlowCoordinator();
    const client = successfulClient();
    const input = {
      authorization: authorization(),
      challenge: challenge(),
      client,
      fetchImpl: vi.fn(async () => Response.json({ ok: true })) as unknown as typeof fetch,
      resourceId: "resource_weather",
      storage: memoryStorage()
    };

    const first = coordinator.execute(input);
    const second = coordinator.execute(input);
    expect(first).toBe(second);
    await expect(first).resolves.toMatchObject({ state: "confirmed" });
    await expect(coordinator.execute(input)).resolves.toMatchObject({ state: "confirmed" });
    expect(client.verifyPayment).toHaveBeenCalledTimes(1);
    expect(client.settlePayment).toHaveBeenCalledTimes(1);
  });

  it("keeps verification timeouts indeterminate and never calls or settles", async () => {
    const client = successfulClient({
      verifyPayment: vi.fn(() => new Promise<PaymentVerification>(() => undefined))
    });
    const fetchImpl = vi.fn();

    const result = await createPaidFlowCoordinator().execute({
      authorization: authorization(),
      challenge: challenge(),
      client,
      fetchImpl: fetchImpl as typeof fetch,
      resourceId: "resource_weather",
      storage: memoryStorage(),
      timeoutMs: 1
    });

    expect(result.state).toBe("indeterminate");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(client.settlePayment).not.toHaveBeenCalled();
  });

  it("does not convert pending finality into success", async () => {
    const client = successfulClient({
      getReceipt: vi.fn(async () => receipt({ status: "pending" }))
    });
    const result = await execute(client);

    expect(result).toMatchObject({ state: "pending", receipt: { status: "pending" } });
    expect(result.state).not.toBe("confirmed");
  });

  it("treats an explicit failed settlement as rejected", async () => {
    const storage = memoryStorage();
    const client = successfulClient({
      settlePayment: vi.fn(async () => {
        throw new ApiClientError({
          code: "SETTLEMENT_FAILED",
          details: { status: "failed" },
          message: "Stellar settlement failed.",
          status: 422
        });
      })
    });
    const result = await createPaidFlowCoordinator().execute({
      authorization: authorization(),
      challenge: challenge(),
      client,
      fetchImpl: vi.fn(async () => Response.json({ ok: true })) as unknown as typeof fetch,
      resourceId: "resource_weather",
      storage
    });

    expect(result).toMatchObject({
      paidResponse: { body: { ok: true } },
      state: "rejected"
    });
    expect(storage.value()).toBe("");
  });

  it("recovers a submitted receipt after a browser refresh without a signed payload", async () => {
    const storage = memoryStorage();
    await createPaidFlowCoordinator().execute({
      authorization: authorization(),
      challenge: challenge(),
      client: successfulClient({ getReceipt: vi.fn(async () => receipt({ status: "pending" })) }),
      fetchImpl: vi.fn(async () => Response.json({ ok: true })) as unknown as typeof fetch,
      resourceId: "resource_weather",
      storage
    });

    const refreshedClient = { getReceipt: vi.fn(async () => receipt()) };
    const recovered = await createPaidFlowCoordinator().recover({
      client: refreshedClient,
      resourceId: "resource_weather",
      storage
    });

    expect(recovered).toMatchObject({ state: "confirmed", transactionHash: "tx_1" });
    expect(refreshedClient.getReceipt).toHaveBeenCalledWith("receipt_1");
    expect(storage.value()).not.toMatch(/canonical-header|signed-xdr/i);
  });

  it("locks an unresolved verified attempt after refresh instead of prompting twice", async () => {
    const storage = memoryStorage();
    const client = successfulClient();
    const result = await createPaidFlowCoordinator().execute({
      authorization: authorization(),
      challenge: challenge(),
      client,
      fetchImpl: vi.fn(async () => {
        throw new Error("network timeout");
      }) as unknown as typeof fetch,
      resourceId: "resource_weather",
      storage
    });
    expect(result.state).toBe("indeterminate");

    const recovered = await createPaidFlowCoordinator().recover({
      client,
      resourceId: "resource_weather",
      storage
    });
    expect(recovered).toMatchObject({ state: "indeterminate" });
    expect(client.getReceipt).toHaveBeenCalledTimes(0);
  });

  it("keeps all user-facing lifecycle labels distinct", () => {
    expect(new Set(Object.values(paidFlowStateLabels)).size).toBe(8);
  });
});

function execute(client = successfulClient()) {
  return createPaidFlowCoordinator().execute({
    authorization: authorization(),
    challenge: challenge(),
    client,
    fetchImpl: vi.fn(async () => Response.json({ ok: true })) as unknown as typeof fetch,
    resourceId: "resource_weather",
    storage: memoryStorage()
  });
}

function successfulClient(overrides: Record<string, unknown> = {}) {
  return {
    getReceipt: vi.fn(async () => receipt()),
    settlePayment: vi.fn(async () => settlement()),
    verifyPayment: vi.fn(async () => verification()),
    ...overrides
  };
}

function verification(): PaymentVerification {
  return {
    extra: {
      lumenbazaar: {
        adapter: "@x402/stellar",
        correlationId: "corr_1",
        network: "stellar:testnet",
        paymentAttemptId: "attempt_1",
        paymentHash: "hash_1",
        status: "verified"
      }
    },
    isValid: true
  };
}

function settlement(): Settlement {
  return {
    amount: "500000",
    extra: {
      lumenbazaar: {
        correlationId: "corr_1",
        ledger: 123,
        paymentAttemptId: "attempt_1",
        receiptId: "receipt_1",
        settlementId: "settlement_1",
        status: "confirmed",
        transactionHash: "tx_1"
      }
    },
    network: "stellar:testnet",
    success: true,
    transaction: "tx_1"
  };
}

function receipt(overrides: Partial<Receipt> = {}): Receipt {
  return {
    amount: "500000",
    assetCode: "USDC",
    assetIssuer: "GISSUER",
    correlationId: "corr_1",
    createdAt: "2026-10-07T10:00:00.000Z",
    evidenceHash: "evidence_1",
    failureCode: null,
    failureReason: null,
    id: "receipt_1",
    ledger: overrides.status === "pending" ? null : 123,
    network: "stellar:testnet",
    paymentAttemptId: "attempt_1",
    resourceId: "resource_weather",
    sellerId: "seller_weather",
    settledAt: overrides.status === "pending" ? null : "2026-10-07T10:00:10.000Z",
    status: "finalized",
    transactionHash: overrides.status === "pending" ? null : "tx_1",
    updatedAt: "2026-10-07T10:00:10.000Z",
    ...overrides
  };
}

function authorization(): SignedPaymentAuthorization {
  return {
    account: "GPAYER",
    authorizedAt: 2_000,
    challengeFingerprint: "fingerprint",
    header: "canonical-header",
    payload: {
      accepted: challenge().requirement,
      payload: { transaction: "signed-xdr" },
      resource: challenge().challenge.resource,
      x402Version: 2
    }
  };
}

function challenge(): ValidatedPaymentChallenge {
  const requirement = {
    amount: "500000",
    asset: "CASSET",
    extra: { areFeesSponsored: true },
    maxTimeoutSeconds: 60,
    network: "stellar:testnet" as const,
    payTo: "GRECIPIENT",
    scheme: "exact" as const
  };
  return {
    challenge: {
      accepts: [requirement],
      resource: { url: "https://seller.example/weather?city=Lagos" },
      x402Version: 2
    },
    expiresAt: 60_000,
    fingerprint: "fingerprint",
    receivedAt: 1_000,
    request: {
      headers: [["accept", "application/json"]],
      method: "GET",
      url: "https://seller.example/weather?city=Lagos"
    },
    requirement
  };
}

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
    value: () => [...values.values()].join("\n")
  };
}
