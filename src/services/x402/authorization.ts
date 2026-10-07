import { decodePaymentSignatureHeader, encodePaymentSignatureHeader } from "@x402/core/http";
import { PaymentPayloadV2Schema } from "@x402/core/schemas";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import { ExactStellarScheme, type ClientStellarSigner } from "@x402/stellar";

import { getNetworkConfig } from "@/config/networks";
import {
  paymentPayloadV2Schema,
  type PaymentPayload as LumenPaymentPayload
} from "@/services/api/schemas";
import { connectFreighterWallet, type WalletConnectionState } from "@/services/wallets";

import { assertChallengeFresh, type ValidatedPaymentChallenge } from "./challenge";

export const paymentSignatureHeader = "PAYMENT-SIGNATURE";

export type AuthorizationErrorCode =
  | "AUTHORIZATION_FAILED"
  | "CHALLENGE_EXPIRED"
  | "SIGNATURE_INVALID"
  | "WALLET_ACCOUNT_CHANGED"
  | "WALLET_DISCONNECTED"
  | "WALLET_NETWORK_MISMATCH"
  | "WALLET_REJECTED"
  | "WALLET_UNAVAILABLE";

export class AuthorizationError extends Error {
  readonly code: AuthorizationErrorCode;

  constructor(code: AuthorizationErrorCode, message: string) {
    super(message);
    this.name = "AuthorizationError";
    this.code = code;
  }
}

export type SignedPaymentAuthorization = {
  account: string;
  authorizedAt: number;
  challengeFingerprint: string;
  header: string;
  payload: LumenPaymentPayload["paymentPayload"];
};

type FreighterApi = {
  getAddress: () => Promise<{
    address?: string;
    error?: { message?: string };
  }>;
  getNetwork: () => Promise<{
    error?: { message?: string };
    network?: string;
    networkPassphrase?: string;
  }>;
  signAuthEntry: (
    entryXdr: string,
    options: { address: string; networkPassphrase: string }
  ) => Promise<{
    error?: { message?: string };
    signedAuthEntry: string | null;
    signerAddress: string;
  }>;
};

type Scheme = {
  createPaymentPayload: (
    x402Version: number,
    requirements: PaymentRequirements
  ) => Promise<Pick<PaymentPayload, "payload" | "x402Version">>;
};

type AuthorizationDependencies = {
  connectWallet?: (network: "stellar:testnet") => Promise<WalletConnectionState>;
  createScheme?: (signer: ClientStellarSigner, rpcUrl: string) => Scheme;
  now?: () => number;
  walletApi?: FreighterApi;
};

export async function authorizePaymentChallenge(
  challenge: ValidatedPaymentChallenge,
  dependencies: AuthorizationDependencies = {}
): Promise<SignedPaymentAuthorization> {
  const now = dependencies.now ?? Date.now;
  assertFreshForAuthorization(challenge, now());
  if (challenge.requirement.network !== "stellar:testnet") {
    throw new AuthorizationError(
      "WALLET_NETWORK_MISMATCH",
      "Wallet authorization is enabled only for the selected Stellar testnet."
    );
  }

  const connectWallet = dependencies.connectWallet ?? connectFreighterWallet;
  const connection = await connectWallet("stellar:testnet");
  const account = requireConnectedAccount(connection);
  const walletApi = dependencies.walletApi ?? (await loadFreighterApi());
  const signer = createFreighterSigner(walletApi, account, challenge, now);
  const network = getNetworkConfig("stellar:testnet");
  const createScheme =
    dependencies.createScheme ??
    ((clientSigner: ClientStellarSigner, rpcUrl: string) =>
      new ExactStellarScheme(clientSigner, { url: rpcUrl }));

  let signed: Pick<PaymentPayload, "payload" | "x402Version">;
  try {
    signed = await createScheme(signer, network.rpcUrl).createPaymentPayload(
      2,
      challenge.requirement as PaymentRequirements
    );
  } catch (error) {
    if (error instanceof AuthorizationError) throw error;
    throw new AuthorizationError(
      "AUTHORIZATION_FAILED",
      "The official Stellar authorization could not be created."
    );
  }

  assertFreshForAuthorization(challenge, now());
  const payload = validateSignedPayload({
    accepted: challenge.requirement,
    payload: signed.payload,
    resource: challenge.challenge.resource,
    x402Version: signed.x402Version
  });
  const header = encodePaymentSignatureHeader(payload as PaymentPayload);
  validateEncodedHeader(header, challenge);

  return {
    account,
    authorizedAt: now(),
    challengeFingerprint: challenge.fingerprint,
    header,
    payload
  };
}

function createFreighterSigner(
  walletApi: FreighterApi,
  expectedAccount: string,
  challenge: ValidatedPaymentChallenge,
  now: () => number
): ClientStellarSigner {
  const expectedPassphrase = getNetworkConfig("stellar:testnet").passphrase;

  return {
    address: expectedAccount,
    async signAuthEntry(entryXdr, options) {
      assertFreshForAuthorization(challenge, now());
      const [addressResult, networkResult] = await Promise.all([
        walletApi.getAddress(),
        walletApi.getNetwork()
      ]);
      if (addressResult.error !== undefined || addressResult.address === undefined) {
        throw new AuthorizationError(
          "WALLET_DISCONNECTED",
          "Freighter disconnected before authorization."
        );
      }
      if (addressResult.address !== expectedAccount) {
        throw new AuthorizationError(
          "WALLET_ACCOUNT_CHANGED",
          "The active Freighter account changed before authorization."
        );
      }
      if (
        networkResult.error !== undefined ||
        networkResult.networkPassphrase !== expectedPassphrase ||
        (options?.networkPassphrase !== undefined &&
          options.networkPassphrase !== expectedPassphrase)
      ) {
        throw new AuthorizationError(
          "WALLET_NETWORK_MISMATCH",
          "Freighter must be connected to Stellar testnet before authorization."
        );
      }

      const result = await walletApi.signAuthEntry(entryXdr, {
        address: expectedAccount,
        networkPassphrase: expectedPassphrase
      });
      if (result.error !== undefined) {
        throw new AuthorizationError(
          "WALLET_REJECTED",
          result.error.message ?? "The wallet rejected the authorization request."
        );
      }
      if (result.signedAuthEntry === null || result.signedAuthEntry.length === 0) {
        throw new AuthorizationError(
          "SIGNATURE_INVALID",
          "Freighter did not return a signed authorization entry."
        );
      }
      if (result.signerAddress !== expectedAccount) {
        throw new AuthorizationError(
          "WALLET_ACCOUNT_CHANGED",
          "Freighter signed with a different account than the connected account."
        );
      }

      return {
        signedAuthEntry: result.signedAuthEntry,
        signerAddress: result.signerAddress
      };
    }
  };
}

function requireConnectedAccount(connection: WalletConnectionState) {
  if (connection.status === "mismatch") {
    throw new AuthorizationError(
      "WALLET_NETWORK_MISMATCH",
      "Freighter must be connected to Stellar testnet before authorization."
    );
  }
  if (connection.status === "disconnected") {
    throw new AuthorizationError("WALLET_DISCONNECTED", "Freighter is disconnected.");
  }
  if (connection.status !== "connected" || connection.address === undefined) {
    throw new AuthorizationError(
      "WALLET_UNAVAILABLE",
      connection.error ?? "Freighter is unavailable."
    );
  }
  return connection.address;
}

function validateSignedPayload(value: unknown) {
  const official = PaymentPayloadV2Schema.safeParse(value);
  const lumen = paymentPayloadV2Schema.safeParse(value);
  if (!official.success || !lumen.success || lumen.data.payload.transaction.length === 0) {
    throw new AuthorizationError(
      "SIGNATURE_INVALID",
      "The wallet returned an invalid x402 v2 Stellar payment payload."
    );
  }
  return lumen.data;
}

function validateEncodedHeader(header: string, challenge: ValidatedPaymentChallenge) {
  try {
    const decoded = paymentPayloadV2Schema.parse(decodePaymentSignatureHeader(header));
    if (
      decoded.accepted.amount !== challenge.requirement.amount ||
      decoded.accepted.asset !== challenge.requirement.asset ||
      decoded.accepted.network !== challenge.requirement.network ||
      decoded.accepted.payTo !== challenge.requirement.payTo ||
      decoded.accepted.maxTimeoutSeconds !== challenge.requirement.maxTimeoutSeconds ||
      decoded.accepted.scheme !== challenge.requirement.scheme ||
      decoded.resource?.url !== challenge.challenge.resource.url
    ) {
      throw new Error("signed terms changed");
    }
  } catch {
    throw new AuthorizationError(
      "SIGNATURE_INVALID",
      "The canonical PAYMENT-SIGNATURE header did not preserve the validated challenge."
    );
  }
}

function assertFreshForAuthorization(challenge: ValidatedPaymentChallenge, now: number) {
  try {
    assertChallengeFresh(challenge, now);
  } catch {
    throw new AuthorizationError(
      "CHALLENGE_EXPIRED",
      "The payment challenge expired. Request fresh terms before authorizing."
    );
  }
}

async function loadFreighterApi(): Promise<FreighterApi> {
  if (typeof window === "undefined") {
    throw new AuthorizationError(
      "WALLET_UNAVAILABLE",
      "Wallet authorization is available only in the browser."
    );
  }
  return import("@stellar/freighter-api") as Promise<FreighterApi>;
}
