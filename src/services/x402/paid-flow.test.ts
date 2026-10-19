import { describe, expect, it, vi } from "vitest";

import { ApiClientError } from "@/services/api/client";
import type { PaymentVerification, Receipt, Settlement } from "@/services/api/schemas";

import type { SignedPaymentAuthorization } from "./authorization";
import type { ValidatedPaymentChallenge } from "./challenge";
import { awaitReceiptFinality, createPaidFlowCoordinator, paidFlowStateLabels } from "./paid-flow";

const fastPolling = {
  initialDelayMs: 1,
  maxDelayMs: 1,
  maxAttempts: 2,
  maxElapsedMs: 50
};

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
      resourceAssetCode: "USDC",
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
      resourceAssetCode: "USDC",
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
      resourceAssetCode: "USDC",
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
      resourceAssetCode: "USDC",
      resourceId: "resource_weather",
      storage
    });

    expect(result).toMatchObject({
      paidResponse: { body: { ok: true } },
      state: "rejected"
    });
    expect(storage.value()).toBe("");
  });

  it("binds recovery metadata to the initiating public account without signed material", async () => {
    const storage = memoryStorage();
    await createPaidFlowCoordinator().execute({
      authorization: authorization(),
      challenge: challenge(),
      client: successfulClient({ getReceipt: vi.fn(async () => receipt({ status: "pending" })) }),
      fetchImpl: vi.fn(async () => Response.json({ ok: true })) as unknown as typeof fetch,
      receiptPolling: fastPolling,
      resourceAssetCode: "USDC",
      resourceId: "resource_weather",
      storage
    });

    expect(storage.value()).toContain('"account":"GPAYER"');
    expect(storage.value()).not.toMatch(/canonical-header|signed-xdr|PAYMENT-SIGNATURE/i);
  });

  it("keeps read-only receipt recovery after an account change following submission", async () => {
    const storage = memoryStorage();
    await createPaidFlowCoordinator().execute({
      authorization: authorization(),
      challenge: challenge(),
      client: successfulClient({ getReceipt: vi.fn(async () => receipt({ status: "pending" })) }),
      fetchImpl: vi.fn(async () => Response.json({ ok: true })) as unknown as typeof fetch,
      receiptPolling: fastPolling,
      resourceAssetCode: "USDC",
      resourceId: "resource_weather",
      storage
    });

    const refreshedClient = { getReceipt: vi.fn(async () => receipt({ status: "pending" })) };
    const recovered = await createPaidFlowCoordinator().recover({
      account: "GOTHERACCOUNT",
      client: refreshedClient,
      receiptPolling: fastPolling,
      resourceId: "resource_weather",
      storage
    });

    expect(recovered).toMatchObject({
      accountBinding: {
        activeAccount: "GOTHERACCOUNT",
        initiatingAccount: "GPAYER",
        status: "changed"
      },
      state: "pending"
    });
    expect(refreshedClient.getReceipt).toHaveBeenCalledWith("receipt_1");
  });

  it("preserves confirmed receipt evidence after an account change and restores eligibility on return", async () => {
    const storage = memoryStorage();
    await createPaidFlowCoordinator().execute({
      authorization: authorization(),
      challenge: challenge(),
      client: successfulClient(),
      fetchImpl: vi.fn(async () => Response.json({ ok: true })) as unknown as typeof fetch,
      receiptPolling: fastPolling,
      resourceAssetCode: "USDC",
      resourceId: "resource_weather",
      storage
    });

    const changed = await createPaidFlowCoordinator().recover({
      account: "GOTHERACCOUNT",
      client: { getReceipt: vi.fn(async () => receipt()) },
      resourceId: "resource_weather",
      storage
    });
    expect(changed).toMatchObject({
      accountBinding: { initiatingAccount: "GPAYER", status: "changed" },
      receipt: { id: "receipt_1", status: "finalized" },
      state: "confirmed"
    });

    const returned = await createPaidFlowCoordinator().recover({
      account: "GPAYER",
      client: { getReceipt: vi.fn(async () => receipt()) },
      resourceId: "resource_weather",
      storage
    });
    expect(returned?.accountBinding?.status).toBe("matches");
  });

  it("recovers a submitted receipt after a browser refresh without a signed payload", async () => {
    const storage = memoryStorage();
    await createPaidFlowCoordinator().execute({
      authorization: authorization(),
      challenge: challenge(),
      client: successfulClient({ getReceipt: vi.fn(async () => receipt({ status: "pending" })) }),
      fetchImpl: vi.fn(async () => Response.json({ ok: true })) as unknown as typeof fetch,
      receiptPolling: fastPolling,
      resourceAssetCode: "USDC",
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
      resourceAssetCode: "USDC",
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

  it("returns indeterminate when receipt amount does not match approved payment", async () => {
    const client = successfulClient({
      getReceipt: vi.fn(async () => receipt({ amount: "600000" }))
    });
    const result = await execute(client);

    expect(result).toMatchObject({
      state: "indeterminate",
      validationErrors: expect.arrayContaining([expect.stringContaining("Amount mismatch")])
    });
  });

  it("returns indeterminate when receipt asset code does not match approved payment", async () => {
    const client = successfulClient({
      getReceipt: vi.fn(async () => receipt({ assetCode: "USDT" }))
    });
    const result = await execute(client);

    expect(result).toMatchObject({
      state: "indeterminate",
      validationErrors: expect.arrayContaining([expect.stringContaining("Asset code mismatch")])
    });
  });

  it("returns indeterminate when receipt asset issuer does not match approved payment", async () => {
    const client = successfulClient({
      getReceipt: vi.fn(async () => receipt({ assetIssuer: "GOTHER" }))
    });
    const result = await execute(client);

    expect(result).toMatchObject({
      state: "indeterminate",
      validationErrors: expect.arrayContaining([expect.stringContaining("Asset issuer mismatch")])
    });
  });

  it("returns indeterminate when receipt network does not match approved payment", async () => {
    const client = successfulClient({
      getReceipt: vi.fn(async () => receipt({ network: "stellar:public" as never }))
    });
    const result = await execute(client);

    expect(result).toMatchObject({
      state: "indeterminate",
      validationErrors: expect.arrayContaining([expect.stringContaining("Network mismatch")])
    });
  });

  it("returns indeterminate when receipt resource ID does not match approved payment", async () => {
    const client = successfulClient({
      getReceipt: vi.fn(async () => receipt({ resourceId: "resource_forecast" }))
    });
    const result = await execute(client);

    expect(result).toMatchObject({
      state: "indeterminate",
      validationErrors: expect.arrayContaining([expect.stringContaining("Resource ID mismatch")])
    });
  });

  it("returns indeterminate when receipt payment attempt ID does not match verification", async () => {
    const client = successfulClient({
      getReceipt: vi.fn(async () => receipt({ paymentAttemptId: "attempt_2" }))
    });
    const result = await execute(client);

    expect(result).toMatchObject({
      state: "indeterminate",
      validationErrors: expect.arrayContaining([
        expect.stringContaining("Payment attempt ID mismatch")
      ])
    });
  });

  it("returns indeterminate when receipt correlation ID does not match verification", async () => {
    const client = successfulClient({
      getReceipt: vi.fn(async () => receipt({ correlationId: "corr_2" }))
    });
    const result = await execute(client);

    expect(result).toMatchObject({
      state: "indeterminate",
      validationErrors: expect.arrayContaining([expect.stringContaining("Correlation ID mismatch")])
    });
  });

  it("returns indeterminate when receipt transaction hash does not match settlement", async () => {
    const storage = memoryStorage();
    const client = successfulClient({
      getReceipt: vi.fn(async () => receipt({ transactionHash: "tx_2" }))
    });

    // First execute normally to establish transactionHash in recovery
    const result = await createPaidFlowCoordinator().execute({
      authorization: authorization(),
      challenge: challenge(),
      client,
      fetchImpl: vi.fn(async () => Response.json({ ok: true })) as unknown as typeof fetch,
      resourceAssetCode: "USDC",
      resourceId: "resource_weather",
      storage
    });

    expect(result).toMatchObject({
      state: "indeterminate",
      validationErrors: expect.arrayContaining([
        expect.stringContaining("Transaction hash mismatch")
      ])
    });
  });

  it("keeps all user-facing lifecycle labels distinct", () => {
    expect(new Set(Object.values(paidFlowStateLabels)).size).toBe(8);
  });

  describe("bounded receipt finality polling", () => {
    it("repeats only the receipt lookup until finality and never resettles", async () => {
      const receipts = [
        receipt({ status: "pending" }),
        receipt({ status: "pending" }),
        receipt({ status: "finalized" })
      ];
      const client = successfulClient({
        getReceipt: vi.fn(async () => receipts.shift() ?? receipt())
      });

      const result = await createPaidFlowCoordinator().execute({
        authorization: authorization(),
        challenge: challenge(),
        client,
        fetchImpl: vi.fn(async () => Response.json({ ok: true })) as unknown as typeof fetch,
        receiptPolling: { ...fastPolling, maxAttempts: 3 },
        resourceAssetCode: "USDC",
        resourceId: "resource_weather",
        storage: memoryStorage()
      });

      expect(result).toMatchObject({
        receiptLookupAttempts: 3,
        state: "confirmed"
      });
      expect(client.getReceipt).toHaveBeenCalledTimes(3);
      expect(client.verifyPayment).toHaveBeenCalledTimes(1);
      expect(client.settlePayment).toHaveBeenCalledTimes(1);
    });

    it("stops at the configured limit and reports pending without a terminal receipt", async () => {
      const client = successfulClient({
        getReceipt: vi.fn(async () => receipt({ status: "pending" }))
      });

      const result = await execute(client);

      expect(result).toMatchObject({ receiptLookupAttempts: 2, state: "pending" });
      expect(client.getReceipt).toHaveBeenCalledTimes(2);
      expect(client.settlePayment).toHaveBeenCalledTimes(1);
    });

    it("treats a failed receipt as terminal", async () => {
      const client = successfulClient({
        getReceipt: vi.fn(async () =>
          receipt({
            failureCode: "LEDGER_FAILED",
            failureReason: "Ledger failed.",
            status: "failed"
          })
        )
      });

      const result = await execute(client);

      expect(result).toMatchObject({ receiptLookupAttempts: 1, state: "rejected" });
      expect(client.getReceipt).toHaveBeenCalledTimes(1);
    });

    it("pauses receipt lookups while the tab is hidden or the browser is offline", async () => {
      let blocked = true;
      const listeners = new Set<() => void>();
      const client = { getReceipt: vi.fn(async () => receipt()) };
      const pending = awaitReceiptFinality({
        client,
        polling: {
          initialDelayMs: 1,
          maxAttempts: 2,
          visibility: {
            isHidden: () => blocked,
            subscribe: (listener) => {
              listeners.add(listener);
              return () => listeners.delete(listener);
            }
          }
        },
        receiptId: "receipt_1"
      });

      expect(client.getReceipt).not.toHaveBeenCalled();
      blocked = false;
      for (const listener of listeners) listener();

      await expect(pending).resolves.toMatchObject({ status: "terminal" });
      expect(client.getReceipt).toHaveBeenCalledTimes(1);
    });

    it("cancels in-flight lookups when the consumer unmounts", async () => {
      const controller = new AbortController();
      const client = {
        getReceipt: vi.fn(async () => {
          controller.abort();
          return receipt({ status: "pending" });
        })
      };

      const result = await awaitReceiptFinality({
        client,
        polling: { initialDelayMs: 1, maxAttempts: 5, maxElapsedMs: 500 },
        receiptId: "receipt_1",
        signal: controller.signal
      });

      expect(result).toMatchObject({ attempts: 1, status: "cancelled" });
      expect(client.getReceipt).toHaveBeenCalledTimes(1);
    });

    it("recovers after offline mode without resubmitting settlement", async () => {
      const storage = memoryStorage();
      const client = successfulClient({
        getReceipt: vi.fn(async () => receipt({ status: "pending" }))
      });
      await createPaidFlowCoordinator().execute({
        authorization: authorization(),
        challenge: challenge(),
        client,
        fetchImpl: vi.fn(async () => Response.json({ ok: true })) as unknown as typeof fetch,
        receiptPolling: fastPolling,
        resourceAssetCode: "USDC",
        resourceId: "resource_weather",
        storage
      });

      const recoveredClient = {
        getReceipt: vi.fn(async () => receipt())
      };
      const recovered = await createPaidFlowCoordinator().recover({
        client: recoveredClient,
        receiptPolling: fastPolling,
        resourceId: "resource_weather",
        storage
      });

      expect(recovered).toMatchObject({ state: "confirmed" });
      expect(recoveredClient.getReceipt).toHaveBeenCalledWith("receipt_1");
      expect(client.settlePayment).toHaveBeenCalledTimes(1);
    });

    it("coalesces duplicate consumers so a single poll loop runs", async () => {
      const coordinator = createPaidFlowCoordinator();
      const client = successfulClient({
        getReceipt: vi.fn(async () => receipt({ status: "pending" }))
      });
      const input = {
        authorization: authorization(),
        challenge: challenge(),
        client,
        fetchImpl: vi.fn(async () => Response.json({ ok: true })) as unknown as typeof fetch,
        receiptPolling: fastPolling,
        resourceAssetCode: "USDC",
        resourceId: "resource_weather",
        storage: memoryStorage()
      };

      const first = coordinator.execute(input);
      const second = coordinator.execute(input);

      expect(first).toBe(second);
      await expect(first).resolves.toMatchObject({ state: "pending" });
      expect(client.getReceipt).toHaveBeenCalledTimes(2);
    });
  });
});

function execute(client = successfulClient()) {
  return createPaidFlowCoordinator().execute({
    authorization: authorization(),
    challenge: challenge(),
    client,
    fetchImpl: vi.fn(async () => Response.json({ ok: true })) as unknown as typeof fetch,
    receiptPolling: fastPolling,
    resourceAssetCode: "USDC",
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
    assetIssuer: "CA7QYNF7SOWQ4VJNMGEVXZHYQACUIM2MRRPFNQ4SLRJRYE67Z2BJQXMR",
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
    asset: "CA7QYNF7SOWQ4VJNMGEVXZHYQACUIM2MRRPFNQ4SLRJRYE67Z2BJQXMR",
    extra: { areFeesSponsored: true },
    maxTimeoutSeconds: 60,
    network: "stellar:testnet" as const,
    payTo: "GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE",
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
