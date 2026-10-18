import { apiClient, type LumenBazaarApiClient } from "@/services/api/client";
import type { Resource } from "@/services/api/schemas";
import { currentRuntimeMode } from "@/services/runtime-mode";
import { isDemoMode, type RuntimeEnvironment } from "@/config/runtime";
import { findDemoResource } from "@/fixtures/lumenbazaar";

import { resolveAvailability, resolveCatalogFreshness } from "@/services/resource-health";

export const maxComparisonResources = 4;

export type ComparisonRow = {
  key: string;
  label: string;
  values: Array<string | null>;
  prominent: boolean;
};

export type ComparisonColumn = {
  assetCode: string;
  id: string;
  name: string;
  network: string;
  seller: string;
  unavailable: boolean;
};

export type ResourceComparison = {
  assetContractMismatch: boolean;
  columns: ComparisonColumn[];
  fetchedAt: string;
  networkMismatch: boolean;
  rows: ComparisonRow[];
  schemaMismatch: boolean;
  source: "api" | "demo";
  unavailableIds: string[];
  unknownFieldCount: number;
};

type ComparisonClient = Pick<LumenBazaarApiClient, "getResource">;

/**
 * Parses the `ids` query parameter for the comparison view.
 *
 * Deduplicates, validates identifiers, and enforces the bounded selection so a
 * copied link cannot request an unbounded comparison.
 */
export function parseComparisonIds(raw: string | string[] | undefined): string[] {
  const segments = (Array.isArray(raw) ? raw : raw === undefined ? [] : [raw])
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && /^[A-Za-z0-9_-]{1,128}$/.test(value));

  return [...new Set(segments)].slice(0, maxComparisonResources);
}

export async function loadResourceComparison(
  resourceIds: string[],
  client: ComparisonClient = apiClient,
  mode: RuntimeEnvironment = currentRuntimeMode()
): Promise<ResourceComparison> {
  const ids = [...new Set(resourceIds)].slice(0, maxComparisonResources);
  const unavailable: string[] = [];
  let resources: Resource[];

  if (isDemoMode(mode)) {
    resources = ids.flatMap((id) => {
      const resource = findDemoResource(id);

      if (resource === undefined) {
        unavailable.push(id);
        return [];
      }

      return [resource];
    });
  } else {
    const settled = await Promise.all(
      ids.map(async (id) => {
        try {
          return await client.getResource(id);
        } catch {
          return null;
        }
      })
    );

    resources = settled.filter((resource): resource is Resource => resource !== null);
    unavailable.push(...ids.filter((id, index) => settled[index] === null));
  }

  return {
    ...buildResourceComparison(resources),
    fetchedAt: new Date().toISOString(),
    source: isDemoMode(mode) ? "demo" : "api",
    unavailableIds: unavailable
  };
}

/**
 * Builds a side-by-side comparison from live resource records.
 *
 * Missing values stay `null` so the UI can render them as explicitly unknown
 * rather than inferring health or ranking resources with an aggregate score.
 */
export function buildResourceComparison(
  resources: Resource[]
): Omit<ResourceComparison, "fetchedAt" | "source" | "unavailableIds"> {
  const columns = resources.map((resource) => ({
    assetCode: resource.assetCode,
    id: resource.id,
    name: resource.name,
    network: resource.network,
    seller: resource.sellerId,
    unavailable: false
  }));

  const networkMismatch = distinctKnown(resources.map((resource) => resource.network)) > 1;
  const assetContracts = resources.map((resource) => assetContractOf(resource));
  const assetContractMismatch = distinctKnown(assetContracts) > 1;

  const rows: ComparisonRow[] = [
    row(
      "network",
      "Network",
      resources.map((resource) => resource.network),
      true
    ),
    row(
      "type",
      "Type",
      resources.map((resource) => resource.type),
      false
    ),
    row(
      "assetCode",
      "Asset code",
      resources.map((resource) => resource.assetCode),
      false
    ),
    row("assetContract", "Asset contract", assetContracts, true),
    row(
      "amount",
      "Atomic amount",
      resources.map((resource) => resource.amount),
      false
    ),
    row(
      "recipient",
      "Recipient",
      resources.map((resource) => resource.payTo),
      false
    ),
    row(
      "seller",
      "Seller",
      resources.map((resource) => resource.sellerId),
      false
    ),
    row(
      "sellerVerification",
      "Seller verification",
      resources.map((resource) => sellerVerificationOf(resource)),
      false
    ),
    row(
      "availability",
      "Availability",
      resources.map((resource) => {
        const availability = resolveAvailability(resource);
        return availability.state === "unknown" ? null : availability.label;
      }),
      false
    ),
    row(
      "lastProbe",
      "Last successful probe",
      resources.map((resource) => resolveAvailability(resource).lastSuccessfulProbeAt),
      false
    ),
    row(
      "catalogUpdatedAt",
      "Catalog updated",
      resources.map((resource) => resolveCatalogFreshness(resource).catalogUpdatedAt),
      false
    ),
    schemaRow("inputSchema", "Request schema", resources, "inputSchema"),
    schemaRow("outputSchema", "Response schema", resources, "outputSchema")
  ];

  const unknownFieldCount = rows.reduce(
    (count, current) => count + current.values.filter((value) => value === null).length,
    0
  );
  const schemaMismatch =
    schemaCompatibility(resources, "inputSchema") === "incompatible" ||
    schemaCompatibility(resources, "outputSchema") === "incompatible";

  return {
    assetContractMismatch,
    columns,
    networkMismatch,
    rows,
    schemaMismatch,
    unknownFieldCount
  };
}

export function schemaCompatibility(
  resources: Resource[],
  field: "inputSchema" | "outputSchema"
): "matching" | "incompatible" | "unknown" {
  const signatures = resources.map((resource) => schemaSignature(resource[field]));

  if (signatures.some((signature) => signature === null)) return "unknown";

  return new Set(signatures).size === 1 ? "matching" : "incompatible";
}

function schemaRow(
  key: string,
  label: string,
  resources: Resource[],
  field: "inputSchema" | "outputSchema"
): ComparisonRow {
  const compatibility = schemaCompatibility(resources, field);
  const values = resources.map((resource) => {
    const signature = schemaSignature(resource[field]);
    return signature === null ? null : compatibility === "matching" ? "Matching" : "Different";
  });

  return row(key, label, values, false);
}

function row(
  key: string,
  label: string,
  values: Array<string | null>,
  prominent: boolean
): ComparisonRow {
  return {
    key,
    label,
    prominent,
    values: values.map((value) => normalizeValue(value))
  };
}

function normalizeValue(value: string | null) {
  if (value === null) return null;

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function assetContractOf(resource: Resource): string | null {
  for (const key of ["assetContract", "assetContractId", "contractId"]) {
    const value = resource.extensions[key];

    if (typeof value === "string" && value.trim().length > 0) return value;
  }

  return null;
}

function sellerVerificationOf(resource: Resource): string | null {
  const trusted = resource.extensions.trusted;

  if (trusted === true) return "Verified";
  if (trusted === false) return "Unverified";

  return null;
}

function schemaSignature(schema: Record<string, unknown>): string | null {
  if (Object.keys(schema).length === 0) return null;

  return stableStringify(schema);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;

  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value) ?? "null";
}

function distinctKnown(values: Array<string | null>): number {
  return new Set(values.filter((value): value is string => value !== null)).size;
}
