import { z } from "zod";

export const networkIdSchema = z.enum(["stellar:testnet", "stellar:pubnet"]);
export type NetworkId = z.infer<typeof networkIdSchema>;

export type NetworkConfig = {
  id: NetworkId;
  label: string;
  passphrase: string;
  horizonUrl: string;
  rpcUrl: string;
  explorerUrl: string;
  defaultAssetCode: string;
  defaultAssetIssuer: string;
};

export const stellarNetworks: Record<NetworkId, NetworkConfig> = {
  "stellar:pubnet": {
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
