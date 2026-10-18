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

/**
 * Allowlisted fields for settlement evidence export.
 * Only these fields are included when exporting PaymentActivity records as JSON or CSV.
 * Fields not on this allowlist are explicitly dropped to prevent accidental data leakage.
 */
export type ReceiptExportRecord = {
  attempt_id: string;
  attempt_created_at: string;
  network: string;
  asset_code: string;
  amount: string;
  status: string;
  seller_id: string;
  resource_id: string;
  failure_code: string | null;
  failure_reason: string | null;
  receipt_id: string | null;
  receipt_status: string | null;
  transaction_hash: string | null;
  correlation_id: string | null;
  receipt_created_at: string | null;
  settlement_id: string | null;
  ledger: number | null;
};

/**
 * Metadata included with every settlement evidence export.
 */
export type ExportMetadata = {
  exportTimestamp: string; // ISO-8601 UTC
  evidenceSource: "live" | "demo";
  activeFilters: PaymentActivityFilters;
  pageInfo: {
    pageSize: number;
    recordsOnThisPage: number;
  };
};

/**
 * Paginated response for payment activity.
 * Cursors are opaque tokens managed entirely by the backend.
 * Clients must never construct, modify, or decode cursors.
 */
export type PaginatedPaymentActivityResponse = {
  items: PaymentActivity[];
  nextCursor?: string; // Undefined if on final page
  previousCursor?: string; // Undefined if on first page
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

/**
 * Sanitizes a PaymentActivity for export, returning only allowlisted fields.
 * Redacts forbidden fields (signatures, auth entries, secrets, raw error messages).
 * Preserves amounts and identifiers as strings to maintain precision.
 *
 * @param activity The PaymentActivity to sanitize
 * @returns A ReceiptExportRecord containing only allowlisted fields
 */
export function sanitizeReceiptForExport(activity: PaymentActivity): ReceiptExportRecord {
  return {
    attempt_id: activity.attempt.id,
    attempt_created_at: activity.attempt.createdAt,
    network: activity.attempt.network,
    asset_code: activity.attempt.assetCode,
    amount: activity.attempt.amount, // Preserve as string, never convert to number
    status: paymentActivityStatus(activity),
    seller_id: activity.attempt.sellerId,
    resource_id: activity.attempt.resourceId,
    failure_code: activity.attempt.failureCode,
    failure_reason: activity.attempt.failureReason,
    receipt_id: activity.receipt?.id ?? null,
    receipt_status: activity.receipt?.status ?? null,
    transaction_hash: activity.settlement?.transactionHash ?? activity.receipt?.transactionHash ?? null,
    correlation_id: activity.receipt?.correlationId ?? null,
    receipt_created_at: activity.receipt?.createdAt ?? null,
    settlement_id: activity.settlement?.id ?? null,
    ledger: activity.settlement?.ledger ?? null
  };
}

/**
 * Escapes a value for safe CSV export, handling formula injection and RFC 4180 quoting.
 * - Prefixes formula-injection payloads with single quote
 * - Quotes cells containing commas, quotes, or newlines
 * - Escapes internal quotes as double-quotes per RFC 4180
 *
 * @param value The value to escape (can be string, number, boolean, or null)
 * @returns The escaped value safe for CSV export
 */
function escapeCSVValue(value: string | number | boolean | null): string {
  if (value === null || value === undefined) {
    return "";
  }

  // Convert to string
  let str = String(value);

  // Protect against formula injection (=, +, -, @, tab)
  if (/^[=+\-@\t]/.test(str)) {
    str = "'" + str;
  }

  // RFC 4180: Quote if contains comma, quote, or newline
  if (/[",\n]/.test(str)) {
    // Escape internal quotes by doubling them
    str = '"' + str.replace(/"/g, '""') + '"';
  }

  return str;
}

/**
 * Exports sanitized payment activities as JSON with metadata.
 * Generates a valid JSON document containing metadata and records.
 *
 * @param activities The payment activities to export
 * @param filters The active filters applied at export time
 * @param evidenceSource Whether data is from live API or demo fixtures
 * @returns A JSON string ready for file download
 */
export function exportToJSON(
  activities: PaymentActivity[],
  filters: PaymentActivityFilters = {},
  evidenceSource: "live" | "demo" = "demo"
): string {
  const sanitized = activities.map(sanitizeReceiptForExport);

  const metadata: ExportMetadata = {
    exportTimestamp: new Date().toISOString(),
    evidenceSource,
    activeFilters: filters,
    pageInfo: {
      pageSize: sanitized.length,
      recordsOnThisPage: sanitized.length
    }
  };

  const exportData = {
    metadata,
    records: sanitized
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Exports sanitized payment activities as CSV with metadata block and RFC 4180 compliance.
 * Includes UTF-8 BOM for Excel compatibility.
 *
 * @param activities The payment activities to export
 * @param filters The active filters applied at export time
 * @param evidenceSource Whether data is from live API or demo fixtures
 * @returns A CSV string with BOM ready for file download
 */
export function exportToCSV(
  activities: PaymentActivity[],
  filters: PaymentActivityFilters = {},
  evidenceSource: "live" | "demo" = "demo"
): string {
  const sanitized = activities.map(sanitizeReceiptForExport);

  const metadata: ExportMetadata = {
    exportTimestamp: new Date().toISOString(),
    evidenceSource,
    activeFilters: filters,
    pageInfo: {
      pageSize: sanitized.length,
      recordsOnThisPage: sanitized.length
    }
  };

  const lines: string[] = [];

  // Metadata block (human-readable, not machine-parseable as data)
  lines.push('Metadata,,');
  lines.push(`exportTimestamp,${escapeCSVValue(metadata.exportTimestamp)},`);
  lines.push(`evidenceSource,${escapeCSVValue(metadata.evidenceSource)},`);

  // Active filters
  Object.entries(metadata.activeFilters).forEach(([key, value]) => {
    if (value !== undefined) {
      lines.push(`activeFilters_${key},${escapeCSVValue(String(value))},`);
    }
  });

  // Page info
  lines.push(`pageInfo_pageSize,${metadata.pageInfo.pageSize},`);
  lines.push(`pageInfo_recordsOnThisPage,${metadata.pageInfo.recordsOnThisPage},`);

  // Empty line before data
  lines.push(',,');

  // Header row (column names from ReceiptExportRecord keys)
  const headers: (keyof ReceiptExportRecord)[] = [
    'attempt_id',
    'attempt_created_at',
    'network',
    'asset_code',
    'amount',
    'status',
    'seller_id',
    'resource_id',
    'failure_code',
    'failure_reason',
    'receipt_id',
    'receipt_status',
    'transaction_hash',
    'correlation_id',
    'receipt_created_at',
    'settlement_id',
    'ledger'
  ];

  lines.push(headers.map(escapeCSVValue).join(','));

  // Data rows
  sanitized.forEach((record) => {
    const row = headers.map((header) => {
      const value = record[header];
      return escapeCSVValue(value);
    });
    lines.push(row.join(','));
  });

  // Combine with UTF-8 BOM
  const csv = lines.join('\n');
  const bom = '\ufeff'; // UTF-8 BOM

  return bom + csv;
}
