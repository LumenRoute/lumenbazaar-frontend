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
    await expectAuthorizationCode(wallet({ signedAuthEntry: null }), "SIGNATURE_INVALID");
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
    signAuthEntry: vi.fn(async () => ({
      ...(overrides.signError === undefined ? {} : { error: overrides.signError }),
      signedAuthEntry:
        overrides.signedAuthEntry === undefined ? "signed-auth-entry" : overrides.signedAuthEntry,
      signerAddress: account
    }))
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
