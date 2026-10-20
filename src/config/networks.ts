import { z } from "zod";

export const networkIdSchema = z.enum(["stellar:testnet", "stellar:pubnet"]);
export type NetworkId = z.infer<typeof networkIdSchema>;

/**
 * SEP-41 Asset metadata for a Soroban contract-wrapped asset.
 * Each asset is uniquely identified by its contract ID on a specific network.
 */
export type AssetMetadata = {
  /** Soroban contract ID (C* format) for this asset */
  contractId: string;
  /** Asset symbol/code (1-12 alphanumeric characters) */
  symbol: string;
  /** Number of decimal places (0–7) for human-readable formatting */
  decimals: number;
  /** Optional Stellar issuer account for cross-reference */
  issuer?: string;
};

export type NetworkConfig = {
  id: NetworkId;
  label: string;
  passphrase: string;
  horizonUrl: string;
  rpcUrl: string;
  explorerUrl: string;
  defaultAssetCode: string;
  defaultAssetIssuer: string;
  /** Catalog of known SEP-41 assets on this network, keyed by contract ID */
  assets: AssetMetadata[];
};

export const stellarNetworks: Record<NetworkId, NetworkConfig> = {
  "stellar:pubnet": {
    assets: [
      {
        contractId: "CA7QYNF7SOWQ4VJNMGEVXZHYQACUIM2MRRPFNQ4SLRJRYE67Z2BJQXMR",
        decimals: 6,
        issuer: "GA5ZSEJYB37ENSHJTCQ6GUQ5O6GXJYUYRTP6ESFXUW77K5STH6E3BQI6",
        symbol: "USDC"
      }
    ],
    defaultAssetCode: "USDC",
    defaultAssetIssuer: "GA5ZSEJYB37ENSHJTCQ6GUQ5O6GXJYUYRTP6ESFXUW77K5STH6E3BQI6",
    explorerUrl: "https://stellar.expert/explorer/public",
    horizonUrl: "https://horizon.stellar.org",
    id: "stellar:pubnet",
    label: "Stellar Public Network",
    passphrase: "Public Global Stellar Network ; September 2015",
    rpcUrl: "https://mainnet.sorobanrpc.com"
  },
  "stellar:testnet": {
    assets: [
      {
        contractId: "CBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE",
        decimals: 6,
        issuer: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
        symbol: "USDC"
      },
      {
        contractId: "CBQYB6MKFOPG7BWBT5H3KK43L2CQFWW5J2VJPWMVSWWFDMLZTFGZW7FY",
        decimals: 7,
        symbol: "BRL"
      }
    ],
    defaultAssetCode: "USDC",
    defaultAssetIssuer: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    explorerUrl: "https://stellar.expert/explorer/testnet",
    horizonUrl: "https://horizon-testnet.stellar.org",
    id: "stellar:testnet",
    label: "Stellar Testnet",
    passphrase: "Test SDF Network ; September 2015",
    rpcUrl: "https://soroban-testnet.stellar.org"
  }
};

export function getNetworkConfig(network: NetworkId) {
  return stellarNetworks[network];
}

/**
 * Resolves the network passphrase a wallet reports into a configured network id.
 *
 * Wallets expose their active network as a network passphrase rather than an
 * identifier, so every network comparison has to translate it first. A
 * passphrase that is not configured here resolves to `undefined` and must be
 * treated as an unverified network instead of being assumed to be safe.
 */
export function resolveNetworkId(passphrase: string | undefined): NetworkId | undefined {
  if (passphrase === undefined || passphrase.trim() === "") {
    return undefined;
  }

  return (Object.keys(stellarNetworks) as NetworkId[]).find(
    (id) => stellarNetworks[id].passphrase === passphrase
  );
}

/**
 * Human readable label for a network id.
 *
 * Unknown networks are labeled honestly instead of being presented as one of
 * the supported networks.
 */
export function networkLabel(network: NetworkId | undefined): string {
  return network === undefined ? "Unknown network" : stellarNetworks[network].label;
}
