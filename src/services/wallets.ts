import { getNetworkConfig, type NetworkId } from "@/config/networks";
import { loadRuntimeConfig } from "@/config/runtime";

export type WalletConnectionState = {
  address?: string;
  error?: string;
  expectedNetwork: NetworkId;
  expectedPassphrase: string;
  networkName?: string;
  networkPassphrase?: string;
  status: "disconnected" | "connecting" | "connected" | "mismatch" | "unavailable" | "error";
  walletName?: string;
};

export type WalletOutcomeType =
  | "success"
  | "rejected"
  | "timeout"
  | "unavailable"
  | "network_mismatch"
  | "malformed_signature";

export type WalletOutcome = {
  type: WalletOutcomeType;
  message?: string;
  retryable: boolean;
  errorCode?: string;
};

export const initialWalletState: WalletConnectionState = {
  expectedNetwork: "stellar:testnet",
  expectedPassphrase: getNetworkConfig("stellar:testnet").passphrase,
  status: "disconnected"
};

export async function connectFreighterWallet(
  expectedNetwork: NetworkId = loadRuntimeConfig().defaultNetwork
): Promise<WalletConnectionState> {
  if (typeof window === "undefined") {
    return state("unavailable", expectedNetwork, {
      error: "Wallet connection is only available in the browser."
    });
  }

  await initializeWalletKit(expectedNetwork);

  const freighter = await import("@stellar/freighter-api");
  const allowed = await freighter.isAllowed();
  const allowedError = extractFreighterError(allowed);

  if (allowedError !== undefined) {
    return state("unavailable", expectedNetwork, { error: allowedError });
  }

  const addressResult = allowed.isAllowed
    ? await freighter.getAddress()
    : await freighter.requestAccess();
  const addressError = extractFreighterError(addressResult);

  if (addressError !== undefined || addressResult.address === undefined) {
    return state("error", expectedNetwork, {
      error: addressError ?? "Freighter did not return a public address."
    });
  }

  const network = await freighter.getNetwork();
  const networkError = extractFreighterError(network);

  if (networkError !== undefined) {
    return state("error", expectedNetwork, { error: networkError });
  }

  const expectedPassphrase = getNetworkConfig(expectedNetwork).passphrase;
  const status = isNetworkMismatch(network.networkPassphrase, expectedPassphrase)
    ? "mismatch"
    : "connected";

  return state(status, expectedNetwork, {
    address: addressResult.address,
    networkName: network.network,
    networkPassphrase: network.networkPassphrase,
    walletName: "Freighter"
  });
}

/**
 * Reads the currently selected Freighter public account without prompting.
 * Returns undefined when the extension is unavailable, locked, or not
 * authorized, allowing callers to fall back to read-only recovery.
 */
export async function readActiveWalletAccount(): Promise<string | undefined> {
  if (typeof window === "undefined") return undefined;

  try {
    const freighter = await import("@stellar/freighter-api");
    const allowed = await freighter.isAllowed();
    if (extractFreighterError(allowed) !== undefined || !allowed.isAllowed) return undefined;

    const result = await freighter.getAddress();
    if (extractFreighterError(result) !== undefined) return undefined;
    return result.address;
  } catch {
    return undefined;
  }
}

export async function disconnectWallet(
  expectedNetwork: NetworkId = loadRuntimeConfig().defaultNetwork
) {
  if (typeof window !== "undefined") {
    try {
      const { StellarWalletsKit } = await import("@creit.tech/stellar-wallets-kit");
      await StellarWalletsKit.disconnect();
    } catch {
      // Freighter direct API does not expose a disconnect method; kit disconnect is best effort.
    }
  }

  return state("disconnected", expectedNetwork);
}

export function isNetworkMismatch(
  actualPassphrase: string | undefined,
  expectedPassphrase: string
) {
  return actualPassphrase !== undefined && actualPassphrase !== expectedPassphrase;
}

export function mapAuthorizationErrorToOutcome(errorCode: string): WalletOutcome {
  switch (errorCode) {
    case "WALLET_REJECTED":
      return {
        type: "rejected",
        message: "You declined the payment authorization.",
        retryable: true,
        errorCode
      };
    case "WALLET_TIMEOUT":
    case "WALLET_SIGNING_TIMEOUT":
      return {
        type: "timeout",
        message: "The wallet signing request timed out. Please try again.",
        retryable: true,
        errorCode
      };
    case "WALLET_UNAVAILABLE":
      return {
        type: "unavailable",
        message: "The wallet extension is not available.",
        retryable: true,
        errorCode
      };
    case "SIGNATURE_INVALID":
    case "WALLET_MALFORMED_SIGNATURE":
      return {
        type: "malformed_signature",
        message: "The wallet returned an invalid signature. Please try again.",
        retryable: true,
        errorCode
      };
    case "WALLET_NETWORK_MISMATCH":
      return {
        type: "network_mismatch",
        message: "The wallet is on a different network. Please switch to Stellar testnet.",
        retryable: false,
        errorCode
      };
    default:
      return {
        type: "unavailable",
        message: "An unexpected wallet error occurred.",
        retryable: true,
        errorCode
      };
  }
}

async function initializeWalletKit(expectedNetwork: NetworkId) {
  const [{ FREIGHTER_ID, FreighterModule }, { Networks, StellarWalletsKit }] = await Promise.all([
    import("@creit.tech/stellar-wallets-kit/modules/freighter"),
    import("@creit.tech/stellar-wallets-kit")
  ]);

  StellarWalletsKit.init({
    authModal: {
      hideUnsupportedWallets: true,
      showInstallLabel: true
    },
    modules: [new FreighterModule()],
    network: expectedNetwork === "stellar:pubnet" ? Networks.PUBLIC : Networks.TESTNET,
    selectedWalletId: FREIGHTER_ID
  });
}

function state(
  status: WalletConnectionState["status"],
  expectedNetwork: NetworkId,
  overrides: Partial<WalletConnectionState> = {}
): WalletConnectionState {
  const network = getNetworkConfig(expectedNetwork);

  return {
    expectedNetwork,
    expectedPassphrase: network.passphrase,
    status,
    ...overrides
  };
}

function extractFreighterError(result: { error?: { message?: string } }) {
  return result.error?.message;
}
