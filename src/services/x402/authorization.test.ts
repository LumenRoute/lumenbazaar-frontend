import { decodePaymentSignatureHeader } from "@x402/core/http";
import type { ClientStellarSigner } from "@x402/stellar";
import { describe, expect, it, vi } from "vitest";

import { getNetworkConfig } from "@/config/networks";
import type { WalletConnectionState } from "@/services/wallets";

import {
  AuthorizationError,
  authorizePaymentChallenge,
  paymentSignatureHeader
} from "./authorization";
import type { ValidatedPaymentChallenge } from "./challenge";

const account = "GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE";
const testnetPassphrase = getNetworkConfig("stellar:testnet").passphrase;

describe("Freighter x402 authorization", () => {
  it("creates the official payload and canonical signature header", async () => {
    const walletApi = wallet();
    const result = await authorizePaymentChallenge(challenge(), {
      connectWallet: async () => connection(),
      createScheme: schemeCallingWallet,
      now: () => 2_000,
      walletApi
    });

    expect(result.account).toBe(account);
    expect(result.challengeFingerprint).toBe("fingerprint");
    expect(decodePaymentSignatureHeader(result.header)).toMatchObject({
      accepted: challenge().requirement,
      payload: { transaction: "c2lnbmVkLXRyYW5zYWN0aW9u" },
      resource: { url: challenge().challenge.resource.url },
      x402Version: 2
    });
    expect(paymentSignatureHeader).toBe("PAYMENT-SIGNATURE");
    expect(walletApi.signAuthEntry).toHaveBeenCalledWith("auth-entry-xdr", {
      address: account,
      networkPassphrase: testnetPassphrase
    });
  });

  it.each([
    [
      "disconnected",
      connection({ address: undefined, status: "disconnected" }),
      "WALLET_DISCONNECTED"
    ],
    ["network mismatch", connection({ status: "mismatch" }), "WALLET_NETWORK_MISMATCH"],
    ["unavailable", connection({ address: undefined, status: "unavailable" }), "WALLET_UNAVAILABLE"]
  ])("rejects a %s wallet before signing", async (_name, walletState, code) => {
    await expect(
      authorizePaymentChallenge(challenge(), {
        connectWallet: async () => walletState,
        createScheme: schemeCallingWallet,
        now: () => 2_000,
        walletApi: wallet()
      })
    ).rejects.toMatchObject({ code });
  });

  it("rejects a wallet network change at the signature prompt", async () => {
    await expectAuthorizationCode(
      wallet({ networkPassphrase: getNetworkConfig("stellar:pubnet").passphrase }),
      "WALLET_NETWORK_MISMATCH"
    );
  });

  it("blocks signing when the wallet is on a different network than the payment", async () => {
    const error = await captureAuthorizationError(
      authorizePaymentChallenge(challenge(), {
        connectWallet: async () =>
          connection({
            actualNetwork: "stellar:pubnet",
            networkName: "PUBLIC",
            networkPassphrase: getNetworkConfig("stellar:pubnet").passphrase,
            status: "mismatch"
          }),
        createScheme: schemeCallingWallet,
        now: () => 2_000,
        walletApi: wallet()
      })
    );

    expect(error.code).toBe("WALLET_NETWORK_MISMATCH");
    expect(error.message).toContain(getNetworkConfig("stellar:pubnet").label);
    expect(error.message).toContain(getNetworkConfig("stellar:testnet").label);
  });

  it("blocks signing when the wallet network cannot be verified", async () => {
    const error = await captureAuthorizationError(
      authorizePaymentChallenge(challenge(), {
        connectWallet: async () => connection({ status: "network_unknown" }),
        createScheme: schemeCallingWallet,
        now: () => 2_000,
        walletApi: wallet()
      })
    );

    expect(error.code).toBe("WALLET_NETWORK_MISMATCH");
    expect(error.message).toContain(getNetworkConfig("stellar:testnet").label);
  });

  it("rejects an account change at the signature prompt", async () => {
    await expectAuthorizationCode(wallet({ address: "GCHANGED" }), "WALLET_ACCOUNT_CHANGED");
  });

  it("rejects a disconnect at the signature prompt", async () => {
    await expectAuthorizationCode(
      wallet({ addressError: { message: "Disconnected" } }),
      "WALLET_DISCONNECTED"
    );
  });

  it("preserves a wallet rejection without exposing signed material", async () => {
    await expectAuthorizationCode(
      wallet({ signError: { message: "User declined" } }),
      "WALLET_REJECTED"
    );
  });

  it("rejects a missing or invalid wallet signature", async () => {
    await expectAuthorizationCode(wallet({ signedAuthEntry: null }), "WALLET_MALFORMED_SIGNATURE");
    await expect(
      authorizePaymentChallenge(challenge(), {
        connectWallet: async () => connection(),
        createScheme: () => ({
          createPaymentPayload: async () => ({ payload: { transaction: "" }, x402Version: 2 })
        }),
        now: () => 2_000,
        walletApi: wallet()
      })
    ).rejects.toMatchObject({ code: "SIGNATURE_INVALID" });
  });

  it("times out wallet signing after configured timeout duration", async () => {
    const delayedWallet = wallet({
      signAuthEntry: async () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              signedAuthEntry: "signed-auth-entry",
              signerAddress: account
            });
          }, 2000); // Simulate slow response
        })
    });

    await expect(
      authorizePaymentChallenge(challenge(), {
        connectWallet: async () => connection(),
        createScheme: schemeCallingWallet,
        now: () => 2_000,
        signingTimeoutMs: 100, // 100ms timeout
        walletApi: delayedWallet
      })
    ).rejects.toMatchObject({ code: "WALLET_SIGNING_TIMEOUT" });
  });

  it("allows successful signing within timeout window", async () => {
    const walletApi = wallet();
    const result = await authorizePaymentChallenge(challenge(), {
      connectWallet: async () => connection(),
      createScheme: schemeCallingWallet,
      now: () => 2_000,
      signingTimeoutMs: 5000, // 5 second timeout
      walletApi
    });

    expect(result.account).toBe(account);
    expect(walletApi.signAuthEntry).toHaveBeenCalled();
  });

  it("distinguishes between wallet rejection and timeout", async () => {
    const rejectionError = await captureAuthorizationError(
      authorizePaymentChallenge(challenge(), {
        connectWallet: async () => connection(),
        createScheme: schemeCallingWallet,
        now: () => 2_000,
        walletApi: wallet({ signError: { message: "User declined" } })
      })
    );

    const timeoutError = await captureAuthorizationError(
      authorizePaymentChallenge(challenge(), {
        connectWallet: async () => connection(),
        createScheme: schemeCallingWallet,
        now: () => 2_000,
        signingTimeoutMs: 10,
        walletApi: wallet({
          signAuthEntry: async () =>
            new Promise((resolve) => {
              setTimeout(() => {
                resolve({
                  signedAuthEntry: "signed-auth-entry",
                  signerAddress: account
                });
              }, 100);
            })
        })
      })
    );

    expect(rejectionError.code).toBe("WALLET_REJECTED");
    expect(timeoutError.code).toBe("WALLET_SIGNING_TIMEOUT");
  });

  it("ensures focus can be safely retried after rejection without duplicate authorization", async () => {
    const firstAttempt = await captureAuthorizationError(
      authorizePaymentChallenge(challenge(), {
        connectWallet: async () => connection(),
        createScheme: schemeCallingWallet,
        now: () => 2_000,
        walletApi: wallet({ signError: { message: "User declined" } })
      })
    );

    expect(firstAttempt.code).toBe("WALLET_REJECTED");

    // Second attempt: should succeed (simulating user retry)
    const secondAttempt = await authorizePaymentChallenge(challenge(), {
      connectWallet: async () => connection(),
      createScheme: schemeCallingWallet,
      now: () => 2_000,
      walletApi: wallet()
    });

    expect(secondAttempt.account).toBe(account);
    expect(secondAttempt.header).toBeDefined();
  });

  it("rejects expiration before connection and while the wallet prompt is open", async () => {
    const connectWallet = vi.fn(async () => connection());
    await expect(
      authorizePaymentChallenge(challenge({ expiresAt: 1_000 }), {
        connectWallet,
        createScheme: schemeCallingWallet,
        now: () => 2_000,
        walletApi: wallet()
      })
    ).rejects.toMatchObject({ code: "CHALLENGE_EXPIRED" });
    expect(connectWallet).not.toHaveBeenCalled();

    let time = 2_000;
    const changingTime = () => {
      time += 500;
      return time;
    };
    await expect(
      authorizePaymentChallenge(challenge({ expiresAt: 3_200 }), {
        connectWallet: async () => connection(),
        createScheme: schemeCallingWallet,
        now: changingTime,
        walletApi: wallet()
      })
    ).rejects.toMatchObject({ code: "CHALLENGE_EXPIRED" });
  });

  it("rejects pubnet challenges even when a wallet could connect", async () => {
    const value = challenge();
    value.requirement = { ...value.requirement, network: "stellar:pubnet" };
    await expect(
      authorizePaymentChallenge(value, {
        connectWallet: async () => connection(),
        createScheme: schemeCallingWallet,
        now: () => 2_000,
        walletApi: wallet()
      })
    ).rejects.toMatchObject({ code: "WALLET_NETWORK_MISMATCH" });
  });

  it("detects clock drift: expires precisely at the moment signAuthEntry is called", async () => {
    // The challenge expires at 1_500 and the clock advances 600ms per read:
    // call 1 (pre-connect check): 600 — fresh
    // call 2 (inside signAuthEntry): 1200 — fresh
    // call 3 (post-sign check): 1800 — expired
    let calls = 0;
    const driftingClock = () => {
      calls++;
      return calls * 600;
    };

    await expect(
      authorizePaymentChallenge(challenge({ expiresAt: 1_500 }), {
        connectWallet: async () => connection(),
        createScheme: schemeCallingWallet,
        now: driftingClock,
        walletApi: wallet()
      })
    ).rejects.toMatchObject({ code: "CHALLENGE_EXPIRED" });
  });
});

function connection(overrides: Partial<WalletConnectionState> = {}): WalletConnectionState {
  return {
    address: account,
    expectedNetwork: "stellar:testnet",
    expectedPassphrase: testnetPassphrase,
    networkPassphrase: testnetPassphrase,
    status: "connected",
    walletName: "Freighter",
    ...overrides
  };
}

function challenge(overrides: Partial<ValidatedPaymentChallenge> = {}): ValidatedPaymentChallenge {
  const requirement = {
    amount: "500000",
    asset: "CB256KDRXDO2FYJN3YBYZE5KCU46WIIE67DRP5T7HI45DRH2GM6YOJFS",
    extra: { areFeesSponsored: true },
    maxTimeoutSeconds: 60,
    network: "stellar:testnet" as const,
    payTo: "GDNQZCIXGRK7X5WJZVQVQGTU7BA3D47XAZ7VTTVXB5T5H2L5XRR7YDUA",
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
    requirement,
    ...overrides
  };
}

function wallet(
  overrides: {
    address?: string;
    addressError?: { message?: string };
    networkPassphrase?: string;
    signAuthEntry?: () => Promise<{
      error?: { message?: string };
      signedAuthEntry: string | null;
      signerAddress: string;
    }>;
    signError?: { message?: string };
    signedAuthEntry?: string | null;
  } = {}
) {
  return {
    getAddress: vi.fn(async () => ({
      address: overrides.address ?? account,
      ...(overrides.addressError === undefined ? {} : { error: overrides.addressError })
    })),
    getNetwork: vi.fn(async () => ({
      network: "TESTNET",
      networkPassphrase: overrides.networkPassphrase ?? testnetPassphrase
    })),
    signAuthEntry: vi.fn(
      overrides.signAuthEntry ??
        (async () => ({
          ...(overrides.signError === undefined ? {} : { error: overrides.signError }),
          signedAuthEntry:
            overrides.signedAuthEntry === undefined
              ? "signed-auth-entry"
              : overrides.signedAuthEntry,
          signerAddress: account
        }))
    )
  };
}

function schemeCallingWallet(signer: ClientStellarSigner) {
  return {
    async createPaymentPayload() {
      await signer.signAuthEntry("auth-entry-xdr", {
        address: account,
        networkPassphrase: testnetPassphrase
      });
      return {
        payload: { transaction: "c2lnbmVkLXRyYW5zYWN0aW9u" },
        x402Version: 2
      };
    }
  };
}

async function expectAuthorizationCode(
  walletApi: ReturnType<typeof wallet>,
  code: AuthorizationError["code"]
) {
  await expect(
    authorizePaymentChallenge(challenge(), {
      connectWallet: async () => connection(),
      createScheme: schemeCallingWallet,
      now: () => 2_000,
      walletApi
    })
  ).rejects.toMatchObject({ code });
}

async function captureAuthorizationError(pending: Promise<unknown>): Promise<AuthorizationError> {
  try {
    await pending;
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return error;
    }
    throw error;
  }

  throw new Error("Expected the wallet authorization to fail.");
}
