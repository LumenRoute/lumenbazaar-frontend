import {
  getNetworkConfig,
  networkLabel,
  resolveNetworkId,
  type NetworkId
} from "@/config/networks";
import { loadRuntimeConfig } from "@/config/runtime";

export type WalletConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "mismatch"
  | "network_unknown"
  | "unavailable"
  | "error";

export type WalletConnectionState = {
  address?: string;
  /**
   * Network id detected from the wallet, present only when the passphrase the
   * wallet reported maps to a configured network. It is `undefined` when the
   * wallet could not be placed on a known network.
   */
  actualNetwork?: NetworkId;
  error?: string;
  expectedNetwork: NetworkId;
  expectedPassphrase: string;
  networkName?: string;
  networkPassphrase?: string;
  status: WalletConnectionStatus;
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

/**
 * Outcome of an attempt to move the wallet onto the expected network.
 *
 * The outcomes are intentionally explicit: the frontend never reports a
 * successful switch that it could not verify by re-reading the wallet.
 */
export type WalletNetworkSwitchOutcomeType =
  | "switched"
  | "already_on_expected"
  | "rejected"
  | "manual_required"
  | "not_switched"
  | "unavailable";

export type WalletNetworkSwitchOutcome = {
  type: WalletNetworkSwitchOutcomeType;
  message: string;
  retryable: boolean;
  network?: NetworkId;
};

/**
 * The network information a wallet reported, before it is mapped onto a
 * configured network id.
 */
export type WalletNetworkSnapshot = {
  error?: string;
  networkName?: string;
  networkPassphrase?: string;
};

/**
 * Seam for the network switch capability. Wallets that cannot change networks
 * programmatically leave `requestSwitch` unset, and the frontend then guides
 * the user to switch inside the wallet instead of pretending to do it.
 */
export type WalletNetworkSwitchDependencies = {
  readNetwork?: () => Promise<WalletNetworkSnapshot>;
  requestSwitch?: (network: NetworkId) => Promise<void>;
};

/**
 * Optional network switch capability exposed by a wallet API.
 * The built-in Freighter API does not implement any of these.
 */
const walletNetworkSwitchMethods = ["setNetwork", "switchNetwork", "changeNetwork"] as const;

export const initialWalletState: WalletConnectionState = {
  expectedNetwork: "stellar:testnet",
  expectedPassphrase: getNetworkConfig("stellar:testnet").passphrase,
  status: "disconnected"
};

/**
 * Steps a user has to take inside the wallet when the wallet cannot change
 * networks from the page. The last step re-reads the wallet so the frontend
 * verifies the change instead of assuming it.
 */
export const manualNetworkSwitchSteps: readonly string[] = [
  "Open the Freighter extension.",
  "Switch the network to Stellar Testnet.",
  'Come back here and choose "Re-check network".'
];

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

  return connectionStateFor(expectedNetwork, {
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

/**
 * Re-reads the connected wallet without asking the user to grant access again.
 *
 * This is the recovery step used after the network was changed inside the
 * wallet: it reports the account and network the wallet currently exposes so
 * a resolved mismatch can be reflected in the UI.
 */
export async function reconnectWallet(
  expectedNetwork: NetworkId = loadRuntimeConfig().defaultNetwork
): Promise<WalletConnectionState> {
  if (typeof window === "undefined") {
    return state("unavailable", expectedNetwork, {
      error: "Wallet connection is only available in the browser."
    });
  }

  const freighter = await import("@stellar/freighter-api");
  const allowed = await freighter.isAllowed();
  const allowedError = extractFreighterError(allowed);

  if (allowedError !== undefined) {
    return state("unavailable", expectedNetwork, { error: allowedError });
  }

  if (!allowed.isAllowed) {
    return state("disconnected", expectedNetwork, {
      error: "The wallet is no longer authorized for this site. Reconnect to continue."
    });
  }

  const addressResult = await freighter.getAddress();
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

  return connectionStateFor(expectedNetwork, {
    address: addressResult.address,
    networkName: network.network,
    networkPassphrase: network.networkPassphrase,
    walletName: "Freighter"
  });
}

/**
 * Moves the wallet onto the expected network when the wallet supports it.
 *
 * The result is always verified by reading the wallet network again, so a
 * switch is only reported as successful when the wallet actually reports the
 * expected network afterwards. Wallets without a switch capability report
 * `manual_required` and the user is asked to switch inside the wallet.
 */
export async function switchWalletNetwork(
  expectedNetwork: NetworkId = loadRuntimeConfig().defaultNetwork,
  dependencies: WalletNetworkSwitchDependencies = {}
): Promise<WalletNetworkSwitchOutcome> {
  const readNetwork = dependencies.readNetwork ?? readFreighterNetwork;
  const current = await readNetwork();

  if (current.error !== undefined) {
    return {
      type: "unavailable",
      message: "The wallet did not report its network, so the switch could not be verified.",
      retryable: true
    };
  }

  if (resolveNetworkId(current.networkPassphrase) === expectedNetwork) {
    return {
      type: "already_on_expected",
      message: `The wallet is already on ${networkLabel(expectedNetwork)}.`,
      network: expectedNetwork,
      retryable: false
    };
  }

  const requestSwitch = dependencies.requestSwitch ?? (await resolveWalletNetworkSwitch());

  if (requestSwitch === undefined) {
    return {
      type: "manual_required",
      message: `This wallet cannot change networks from this page. Switch it to ${networkLabel(expectedNetwork)} in the wallet, then choose "Re-check network".`,
      network: expectedNetwork,
      retryable: true
    };
  }

  try {
    await requestSwitch(expectedNetwork);
  } catch {
    return {
      type: "rejected",
      message: `The wallet refused the switch to ${networkLabel(expectedNetwork)}. Switch it inside the wallet, then choose "Re-check network".`,
      network: expectedNetwork,
      retryable: true
    };
  }

  const verified = await readNetwork();

  if (verified.error !== undefined) {
    return {
      type: "unavailable",
      message: "The wallet network could not be read again, so the switch was not verified.",
      network: expectedNetwork,
      retryable: true
    };
  }

  if (resolveNetworkId(verified.networkPassphrase) === expectedNetwork) {
    return {
      type: "switched",
      message: `The wallet is now on ${networkLabel(expectedNetwork)}.`,
      network: expectedNetwork,
      retryable: false
    };
  }

  return {
    type: "not_switched",
    message: `The wallet is still on ${describeNetworkSnapshot(verified)}. Switch it to ${networkLabel(expectedNetwork)} in the wallet, then choose "Re-check network".`,
    network: expectedNetwork,
    retryable: true
  };
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

/**
 * Compares two network passphrases.
 *
 * This is a raw comparison only. A passphrase that is not configured in this
 * frontend is not a match for any network, so callers that act on the result
 * have to treat an unknown passphrase as an unverified network.
 */
export function isNetworkMismatch(
  actualPassphrase: string | undefined,
  expectedPassphrase: string
) {
  return actualPassphrase !== undefined && actualPassphrase !== expectedPassphrase;
}

/**
 * Label of the network the wallet currently reports.
 *
 * A wallet on a network this frontend does not know about is labeled as an
 * unrecognized network instead of being presented as a supported one.
 */
export function describeWalletNetwork(wallet: WalletConnectionState): string {
  if (wallet.actualNetwork !== undefined) {
    return networkLabel(wallet.actualNetwork);
  }

  return describeNetwork(wallet.networkPassphrase, wallet.networkName);
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

/**
 * Maps the account and network reported by a wallet onto a connection state.
 *
 * A wallet that does not report a network resolves to `network_unknown` and
 * stays disconnected from the payment flow, because an unverifiable network
 * cannot be treated as the expected one.
 */
function connectionStateFor(
  expectedNetwork: NetworkId,
  observed: {
    address?: string;
    networkName?: string;
    networkPassphrase?: string;
    walletName?: string;
  }
): WalletConnectionState {
  const actualNetwork = resolveNetworkId(observed.networkPassphrase);
  const status: WalletConnectionStatus =
    actualNetwork === undefined
      ? "network_unknown"
      : actualNetwork === expectedNetwork
        ? "connected"
        : "mismatch";

  return state(status, expectedNetwork, {
    actualNetwork,
    address: observed.address,
    networkName: observed.networkName,
    networkPassphrase: observed.networkPassphrase,
    walletName: observed.walletName
  });
}

function describeNetworkSnapshot(snapshot: WalletNetworkSnapshot): string {
  return describeNetwork(snapshot.networkPassphrase, snapshot.networkName);
}

/**
 * Label of a network reported by a wallet.
 *
 * A passphrase that is not configured here is labeled as an unrecognized
 * network, and a missing passphrase is labeled as an unknown network. Neither
 * is presented as one of the supported networks.
 */
function describeNetwork(
  networkPassphrase: string | undefined,
  networkName: string | undefined
): string {
  const network = resolveNetworkId(networkPassphrase);

  if (network !== undefined) {
    return networkLabel(network);
  }

  if (networkName !== undefined && networkName !== "") {
    return `Unrecognized network (${networkName})`;
  }

  return "Unknown network";
}

async function readFreighterNetwork(): Promise<WalletNetworkSnapshot> {
  if (typeof window === "undefined") {
    return { error: "Wallet connection is only available in the browser." };
  }

  const freighter = await import("@stellar/freighter-api");
  const network = await freighter.getNetwork();
  const error = extractFreighterError(network);

  if (error !== undefined) {
    return { error };
  }

  return {
    networkName: network.network,
    networkPassphrase: network.networkPassphrase
  };
}

/**
 * Resolves the network switch capability of the connected wallet.
 *
 * The Freighter API does not expose a way to change the network of the
 * extension, so this returns undefined for it and the recovery flow falls back
 * to guiding the user through the wallet. The lookup only reads the exported
 * names of the module, so a wallet without the capability is never treated as
 * a wallet that failed to switch.
 */
async function resolveWalletNetworkSwitch(): Promise<
  ((network: NetworkId) => Promise<void>) | undefined
> {
  if (typeof window === "undefined") {
    return undefined;
  }

  const api = (await import("@stellar/freighter-api")) as unknown as Record<string, unknown>;
  const exported = Object.keys(api);
  const method = walletNetworkSwitchMethods.find((candidate) => exported.includes(candidate));

  if (method === undefined) {
    return undefined;
  }

  const request = api[method];

  if (typeof request !== "function") {
    return undefined;
  }

  return async (network: NetworkId) => {
    await (request as (value: string) => Promise<unknown>).call(api, network);
  };
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
