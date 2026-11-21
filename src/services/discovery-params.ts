import { z } from "zod";

import { networkIdSchema, type NetworkId } from "@/config/networks";
import type { ResourceSort, ExploreSearchInput } from "@/services/catalog";
import type { ResourceType } from "@/services/api/schemas";

/**
 * Canonical discovery state for the explore view.
 *
 * The URL is the single source of truth so copied links and browser history
 * restore the same query, filters, sort, and cursor.
 */
export type DiscoveryState = {
  asset?: string;
  cursor?: string;
  extension?: "bazaar" | "mcp";
  maxPrice?: string;
  minPrice?: string;
  network?: NetworkId;
  q: string;
  sellerVerification: "any" | "verified" | "unverified";
  sort: ResourceSort;
  type?: ResourceType;
};

export const discoveryDefaults = {
  q: "",
  sellerVerification: "any" as const,
  sort: "relevance" as const
};

export const resourceSorts = ["relevance", "price-asc", "price-desc", "recent"] as const;
export const sellerVerificationOptions = ["any", "verified", "unverified"] as const;
export const extensionOptions = ["bazaar", "mcp"] as const;
export const resourceTypeOptions = ["http", "mcp"] as const;

const maxQueryLength = 200;
const maxAssetLength = 128;
const maxCursorLength = 1024;
const atomicPricePattern = /^\d+(?:\.\d{1,7})?$/;
const assetPattern = /^[A-Za-z0-9:_.-]+$/;

export function emptyDiscoveryState(): DiscoveryState {
  return {
    ...discoveryDefaults
  };
}

/**
 * Parses URL search params into validated discovery state.
 *
 * Invalid values are dropped (never forwarded to the backend) and known
 * defaults are applied so the same URL always produces the same request.
 */
export function parseDiscoveryState(
  params: URLSearchParams | Record<string, string | string[] | undefined> | undefined
): DiscoveryState {
  const state: DiscoveryState = emptyDiscoveryState();
  const read = createParamReader(params);

  state.q = normalizeQuery(read("q"));
  state.sort = parseEnum(read("sort"), resourceSorts) ?? discoveryDefaults.sort;
  state.sellerVerification =
    parseEnum(read("sellerVerification"), sellerVerificationOptions) ??
    discoveryDefaults.sellerVerification;
  state.network = parseNetwork(read("network"));
  state.type = parseEnum(read("type"), resourceTypeOptions);
  state.extension = parseEnum(read("extension"), extensionOptions);
  state.asset = normalizeAsset(read("asset"));
  state.cursor = normalizeCursor(read("cursor"));

  const minPrice = normalizePrice(read("minPrice"));
  const maxPrice = normalizePrice(read("maxPrice"));

  if (minPrice !== undefined && maxPrice !== undefined && Number(minPrice) > Number(maxPrice)) {
    // Predictable normalization: keep the lower bound, drop the contradictory upper bound.
    state.minPrice = minPrice;
  } else {
    state.minPrice = minPrice;
    state.maxPrice = maxPrice;
  }

  return state;
}

/**
 * Normalizes an in-memory discovery state with the same rules as the URL
 * parser, so drafts, saved searches, and copied links resolve identically.
 */
export function canonicalDiscoveryState(state: DiscoveryState): DiscoveryState {
  return parseDiscoveryState({
    asset: state.asset,
    cursor: state.cursor,
    extension: state.extension,
    maxPrice: state.maxPrice,
    minPrice: state.minPrice,
    network: state.network,
    q: state.q,
    sellerVerification: state.sellerVerification,
    sort: state.sort,
    type: state.type
  });
}

const comparableDiscoveryKeys = [
  "asset",
  "cursor",
  "extension",
  "maxPrice",
  "minPrice",
  "network",
  "q",
  "sellerVerification",
  "sort",
  "type"
] as const satisfies ReadonlyArray<keyof DiscoveryState>;

function isCanonicalDiscoveryState(state: DiscoveryState): boolean {
  const canonical = canonicalDiscoveryState(state);

  return comparableDiscoveryKeys.every((key) => state[key] === canonical[key]);
}

/**
 * Strict runtime schema for a discovery state without pagination, used for
 * anything persisted outside the URL. Fields share the parser's bounds, unknown
 * keys (including `cursor`) are rejected, and the value must already be in
 * canonical form, so stored state can never be read differently from a link.
 */
export const pagelessDiscoveryStateSchema = z
  .strictObject({
    asset: z.string().min(1).max(maxAssetLength).regex(assetPattern).optional(),
    extension: z.enum(extensionOptions).optional(),
    maxPrice: z.string().regex(atomicPricePattern).optional(),
    minPrice: z.string().regex(atomicPricePattern).optional(),
    network: networkIdSchema.optional(),
    q: z.string().max(maxQueryLength),
    sellerVerification: z.enum(sellerVerificationOptions),
    sort: z.enum(resourceSorts),
    type: z.enum(resourceTypeOptions).optional()
  })
  .refine((state) => isCanonicalDiscoveryState(state), {
    message: "Discovery state must already be normalized."
  });

export type PagelessDiscoveryState = z.infer<typeof pagelessDiscoveryStateSchema>;

/**
 * Serializes discovery state to canonical query parameters.
 *
 * Defaults are omitted so equivalent states share one URL. Unknown values are
 * rejected up front, which keeps generated links deep-linkable.
 */
export function serializeDiscoveryState(state: DiscoveryState): string {
  const params = new URLSearchParams();
  const sanitized = canonicalDiscoveryState(state);

  if (sanitized.q.length > 0) params.set("q", sanitized.q);
  if (sanitized.sort !== discoveryDefaults.sort) params.set("sort", sanitized.sort);
  if (sanitized.network !== undefined) params.set("network", sanitized.network);
  if (sanitized.type !== undefined) params.set("type", sanitized.type);
  if (sanitized.extension !== undefined) params.set("extension", sanitized.extension);
  if (sanitized.sellerVerification !== discoveryDefaults.sellerVerification) {
    params.set("sellerVerification", sanitized.sellerVerification);
  }
  if (sanitized.asset !== undefined) params.set("asset", sanitized.asset);
  if (sanitized.minPrice !== undefined) params.set("minPrice", sanitized.minPrice);
  if (sanitized.maxPrice !== undefined) params.set("maxPrice", sanitized.maxPrice);
  if (sanitized.cursor !== undefined) params.set("cursor", sanitized.cursor);

  return params.toString();
}

export function discoveryHref(state: DiscoveryState): string {
  const query = serializeDiscoveryState(state);
  return query.length > 0 ? `/explore?${query}` : "/explore";
}

/**
 * Returns the request payload for a discovery state. Never includes wallet,
 * seller-session, or payment-authorization data.
 */
export function toExploreSearchInput(state: DiscoveryState): ExploreSearchInput {
  return {
    asset: state.asset,
    cursor: state.cursor,
    extension: state.extension,
    maxPrice: state.maxPrice,
    minPrice: state.minPrice,
    network: state.network,
    q: state.q,
    sellerVerification: state.sellerVerification,
    sort: state.sort,
    type: state.type
  };
}

function createParamReader(
  params: URLSearchParams | Record<string, string | string[] | undefined> | undefined
): (key: string) => string | undefined {
  if (params === undefined) return () => undefined;

  if (params instanceof URLSearchParams) return (key) => params.get(key) ?? undefined;

  return (key) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
}

function parseEnum<TValue extends string>(
  value: string | undefined,
  allowed: readonly TValue[]
): TValue | undefined {
  return value !== undefined && allowed.includes(value as TValue) ? (value as TValue) : undefined;
}

function parseNetwork(value: string | undefined): NetworkId | undefined {
  const parsed = networkIdSchema.safeParse(value);

  return parsed.success ? parsed.data : undefined;
}

function normalizeQuery(value: string | undefined) {
  return (value ?? "").trim().slice(0, maxQueryLength);
}

function normalizeAsset(value: string | undefined) {
  if (value === undefined) return undefined;

  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxAssetLength) return undefined;
  if (!assetPattern.test(trimmed)) return undefined;

  return trimmed;
}

function normalizeCursor(value: string | undefined) {
  if (value === undefined) return undefined;

  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxCursorLength) return undefined;
  if (!/^[A-Za-z0-9:_.=-]+$/.test(trimmed)) return undefined;

  return trimmed;
}

function normalizePrice(value: string | undefined) {
  if (value === undefined) return undefined;

  const trimmed = value.trim();
  return atomicPricePattern.test(trimmed) ? trimmed : undefined;
}
