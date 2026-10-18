import { getNetworkConfig, type NetworkId } from "@/config/networks";
import { isValidSorobanContractId } from "@/services/x402/validation";
import type { AssetMetadata } from "@/config/networks";

/**
 * Represents the trust status of a payment asset against the configured registry.
 * 
 * Trust is derived solely from the contract ID matching an entry in the network's
 * configured assets list. Symbol and issuer are never used to establish trust.
 */
export type AssetTrustStatus =
  | { type: "trusted"; registryEntry: AssetMetadata }
  | { type: "unknown"; reason: "not_in_registry" }
  | { type: "malformed"; reason: "invalid_contract_id" }
  | { type: "network_mismatched"; expected: NetworkId };

/**
 * Classifies a payment asset against the configured registry for a network.
 *
 * Classification rules:
 * - **trusted**: Contract ID exactly matches an entry in the network's registry
 * - **unknown**: Contract ID is valid (passes format validation) but not in the registry
 * - **malformed**: Contract ID fails Soroban contract ID format validation
 * - **network_mismatched**: (Reserved for future use; currently not returned)
 *
 * Symbol, name, and issuer are never used to establish trust. A lookalike-symbol
 * asset (same symbol, different contract) is classified as unknown.
 *
 * Contract ID matching is case-sensitive. The Soroban base32 encoding requires
 * uppercase characters; lowercase IDs fail validation and are classified as malformed.
 *
 * @param contractId - Soroban contract ID to classify (C* format, 56 chars)
 * @param network - Network ID to check against
 * @returns AssetTrustStatus indicating the classification
 *
 * @example
 * // Trusted asset
 * classifyAssetTrust(
 *   "CBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE",
 *   "stellar:testnet"
 * )
 * // => { type: "trusted", registryEntry: {...} }
 *
 * @example
 * // Unknown asset (valid contract, not in registry)
 * classifyAssetTrust(
 *   "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
 *   "stellar:testnet"
 * )
 * // => { type: "unknown", reason: "not_in_registry" }
 *
 * @example
 * // Malformed asset (invalid contract ID format)
 * classifyAssetTrust("INVALID_ID", "stellar:testnet")
 * // => { type: "malformed", reason: "invalid_contract_id" }
 */
export function classifyAssetTrust(
  contractId: string,
  network: NetworkId
): AssetTrustStatus {
  // Step 1: Validate contract ID format
  if (!isValidSorobanContractId(contractId)) {
    return { type: "malformed", reason: "invalid_contract_id" };
  }

  // Step 2: Look up in network's registry
  const networkConfig = getNetworkConfig(network);
  const registryEntry = networkConfig.assets.find(
    (asset) => asset.contractId === contractId
  );

  // Step 3: Return appropriate status
  if (registryEntry) {
    return { type: "trusted", registryEntry };
  }

  // Valid format but not in registry
  return { type: "unknown", reason: "not_in_registry" };
}

/**
 * Returns a human-readable label for an asset trust status.
 *
 * Used for accessibility labels, debug logging, and UI display.
 *
 * @param status - AssetTrustStatus to label
 * @returns Human-readable string describing the trust status
 *
 * @example
 * assetTrustLabel({ type: "trusted", registryEntry: {...} })
 * // => "Trusted asset (USDC)"
 *
 * @example
 * assetTrustLabel({ type: "unknown", reason: "not_in_registry" })
 * // => "Unknown asset (not in trusted registry)"
 *
 * @example
 * assetTrustLabel({ type: "malformed", reason: "invalid_contract_id" })
 * // => "Invalid contract ID"
 */
export function assetTrustLabel(status: AssetTrustStatus): string {
  switch (status.type) {
    case "trusted":
      return `Trusted asset (${status.registryEntry.symbol})`;

    case "unknown":
      return "Unknown asset (not in trusted registry)";

    case "malformed":
      return "Invalid contract ID";

    case "network_mismatched":
      return `Network mismatch (expected ${status.expected})`;
  }
}
