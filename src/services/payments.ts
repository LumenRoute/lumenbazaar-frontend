import {
  demoPaymentAttempts,
  demoSettlements,
  findDemoReceiptByAttempt,
  findDemoResource,
  findDemoSeller,
  type DemoPaymentAttempt,
  type DemoSettlement
} from "@/fixtures/lumenbazaar";
import { getNetworkConfig, type NetworkId } from "@/config/networks";
import { apiClient, type LumenBazaarApiClient } from "@/services/api/client";
import type {
  Receipt,
  Resource,
  ResourceStatus,
  ResourceType,
  Seller
} from "@/services/api/schemas";
import type { RuntimeEnvironment } from "@/config/runtime";
import { currentRuntimeMode, requireDemoMode } from "@/services/runtime-mode";

export type PaymentActivityStatus = DemoPaymentAttempt["status"] | DemoSettlement["status"];

export type PaymentActivity = {
  attempt: DemoPaymentAttempt;
  receipt?: Receipt;
  resource?: Resource;
  seller?: Seller;
  settlement?: DemoSettlement;
};

export type PaymentActivityFilters = {
  asset?: string;
  date?: string;
  network?: NetworkId;
  resourceType?: ResourceType;
  sellerId?: string;
  status?: PaymentActivityStatus;
};

export type SellerResourceFilters = {
  asset?: string;
  network?: NetworkId;
  sellerId?: string;
  status?: ResourceStatus;
  type?: ResourceType;
};

export type SellerResourceSnapshot = {
  fetchedAt: string;
  resources: Resource[];
  source: "api" | "demo";
};

type SellerResourceClient = Pick<LumenBazaarApiClient, "listSellerResources">;

export async function loadSellerResourceSnapshot(
  filters: SellerResourceFilters = {},
  client: SellerResourceClient = apiClient,
  mode: RuntimeEnvironment = currentRuntimeMode()
): Promise<SellerResourceSnapshot> {
  if (mode === "demo") {
    return {
      fetchedAt: new Date().toISOString(),
      resources: loadSellerResources(filters, mode),
      source: "demo"
    };
  }

  const sellerId = filters.sellerId ?? "seller_atlas_weather";
  const page = await client.listSellerResources(sellerId, {
    asset: filters.asset,
    network: filters.network,
    status: filters.status,
    type: filters.type
  });
  return {
    fetchedAt: new Date().toISOString(),
    resources: page.resources,
    source: "api"
  };
}

export function loadSellerResources(
  filters: SellerResourceFilters = {},
  mode: RuntimeEnvironment = currentRuntimeMode()
) {
  requireDemoMode(mode);
  const sellerId = filters.sellerId ?? "seller_atlas_weather";

  return demoPaymentResources().filter(
    (resource) =>
      resource.sellerId === sellerId &&
      (filters.status === undefined || resource.status === filters.status) &&
      (filters.network === undefined || resource.network === filters.network) &&
      (filters.asset === undefined ||
        resource.assetCode.toLowerCase() === filters.asset.toLowerCase()) &&
      (filters.type === undefined || resource.type === filters.type)
  );
}

export function loadPaymentActivity(
  filters: PaymentActivityFilters = {},
  mode: RuntimeEnvironment = currentRuntimeMode()
): PaymentActivity[] {
  requireDemoMode(mode);
  return demoPaymentAttempts
    .map((attempt) => ({
      attempt,
      receipt: findDemoReceiptByAttempt(attempt.id),
      resource: findDemoResource(attempt.resourceId),
      seller: findDemoSeller(attempt.sellerId),
      settlement: demoSettlements.find((settlement) => settlement.paymentAttemptId === attempt.id)
    }))
    .filter((activity) => {
      const status = activity.settlement?.status ?? activity.attempt.status;

      return (
        (filters.sellerId === undefined || activity.attempt.sellerId === filters.sellerId) &&
        (filters.status === undefined ||
          status === filters.status ||
          activity.attempt.status === filters.status) &&
        (filters.network === undefined || activity.attempt.network === filters.network) &&
        (filters.date === undefined || sameUtcDate(activity.attempt.createdAt, filters.date)) &&
        (filters.asset === undefined ||
          activity.attempt.assetCode.toLowerCase() === filters.asset.toLowerCase()) &&
        (filters.resourceType === undefined || activity.resource?.type === filters.resourceType)
      );
    })
    .sort((left, right) => right.attempt.createdAt.localeCompare(left.attempt.createdAt));
}

export function loadSellerPaymentActivity(
  sellerId = "seller_atlas_weather",
  mode: RuntimeEnvironment = currentRuntimeMode()
) {
  return loadPaymentActivity({ sellerId }, mode);
}

export function paymentActivityStatus(activity: PaymentActivity) {
  return activity.settlement?.status ?? activity.attempt.status;
}

/**
 * Validates that a transaction hash is in valid Stellar format.
 *
 * Stellar transaction hashes must be exactly 64 hexadecimal characters (SHA-256).
 * This validation rejects synthetic identifiers such as:
 * - "upto-*" prefixed test IDs from reserved scheme tests
 * - "exact-*" prefixed test IDs from exact scheme tests
 * - Playground fixture identifiers
 * - Any non-hex or non-64-char values
 *
 * Only on-chain transaction hashes are accepted as valid settlement evidence
 * for explorer linking and finality confirmation.
 *
 * @param hash The transaction hash to validate
 * @returns true if the hash is a valid 64-char hex string, false for synthetic/invalid identifiers
 */
export function isValidTransactionHash(hash: string | null | undefined): hash is string {
  if (!hash || typeof hash !== "string") {
    return false;
  }
  // Stellar transaction hashes are exactly 64 hexadecimal characters
  return /^[a-f0-9]{64}$/i.test(hash);
}

/**
 * Detects if a transaction identifier is synthetic (test/fixture data).
 *
 * Synthetic identifiers include:
 * - "upto-*": Reserved scheme test identifiers
 * - "exact-*": Exact scheme test identifiers
 * - "playground_*": Playground fixture identifiers
 * - Any other non-hex values that fail Stellar format validation
 *
 * This is used to label test data appropriately in the UI.
 *
 * @param identifier The transaction identifier to check
 * @returns true if the identifier appears to be synthetic/test data, false for valid on-chain hashes
 */
export function isSyntheticTransactionId(identifier: string | null | undefined): boolean {
  if (!identifier || typeof identifier !== "string") {
    return false;
  }

  // Check for known synthetic prefixes
  if (identifier.startsWith("upto-") || identifier.startsWith("exact-") || identifier.startsWith("playground_")) {
    return true;
  }

  // Any non-hex value is considered synthetic
  if (!isValidTransactionHash(identifier)) {
    return true;
  }

  return false;
}

/**
 * Generates a Stellar Expert explorer URL for a transaction.
 * Only generates URLs for valid transaction hashes to prevent broken links.
 * @param network The Stellar network (testnet or pubnet)
 * @param transactionHash The transaction hash to link to
 * @returns The explorer URL if hash is valid, null otherwise
 */
export function explorerTransactionUrl(
  network: NetworkId,
  transactionHash: string | null | undefined
): string | null {
  if (!isValidTransactionHash(transactionHash)) {
    return null;
  }
  return `${getNetworkConfig(network).explorerUrl}/tx/${transactionHash}`;
}

export function formatPaymentAmount(amount: string, assetCode: string) {
  const value = Number(amount);

  if (Number.isFinite(value)) {
    return `${value.toFixed(4)} ${assetCode}`;
  }

  return `${amount} ${assetCode}`;
}

export function shortHash(value: string | null | undefined) {
  if (value === undefined || value === null || value.length <= 16) {
    return value ?? "Unavailable";
  }

  return `${value.slice(0, 8)}...${value.slice(-8)}`;
}

function demoPaymentResources() {
  return [
    ...new Map(
      demoPaymentAttempts.map((attempt) => [
        attempt.resourceId,
        findDemoResource(attempt.resourceId)
      ])
    ).values()
  ].filter((resource): resource is Resource => resource !== undefined);
}

function sameUtcDate(value: string, date: string) {
  return value.slice(0, 10) === date;
}
