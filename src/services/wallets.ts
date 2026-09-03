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
