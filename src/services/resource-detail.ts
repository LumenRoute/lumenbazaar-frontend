import { apiClient, type ApiClientError, type LumenBazaarApiClient } from "@/services/api/client";
import type { Receipt, Resource, ResourcePaymentSummary, Seller } from "@/services/api/schemas";
import { isDemoMode, type RuntimeEnvironment } from "@/config/runtime";

import { demoReceipts, findDemoResource, findDemoSeller } from "@/fixtures/lumenbazaar";
import { currentRuntimeMode } from "@/services/runtime-mode";

export type ResourceDetailSnapshot = {
  receipts: Receipt[];
  requirement: ResourcePaymentSummary;
  resource: Resource;
  seller?: Seller;
  source: "api" | "demo";
};

export type ResourceDetailError =
  | { code: "NOT_FOUND"; message: string }
  | { code: "SERVICE_UNAVAILABLE"; message: string; requestId?: string }
  | { code: "INVALID_RESPONSE"; message: string; requestId?: string }
  | { code: "UNKNOWN_ERROR"; message: string; requestId?: string };

type ResourceDetailClient = Pick<LumenBazaarApiClient, "getResource">;

/**
 * Loads resource detail from the configured backend.
 *
 * In demo mode, loads from local fixtures.
 * In live modes (testnet, mainnet), loads from the API and does NOT fall back to fixtures.
 *
 * Propagates API errors as typed failures:
 * - 404 errors throw ResourceDetailError with code "NOT_FOUND"
 * - 503 errors throw ResourceDetailError with code "SERVICE_UNAVAILABLE"
 * - Invalid responses throw ResourceDetailError with code "INVALID_RESPONSE"
 * - Other errors throw ResourceDetailError with code "UNKNOWN_ERROR"
 *
 * Receipt and seller data are only populated from fixtures in demo mode.
 * In live modes, receipts are always empty and seller data is never populated.
 */
export async function loadResourceDetail(
  resourceId: string,
  client: ResourceDetailClient = apiClient,
  mode: RuntimeEnvironment = currentRuntimeMode()
): Promise<ResourceDetailSnapshot> {
  if (isDemoMode(mode)) {
    const resource = findDemoResource(resourceId);

    if (resource === undefined) {
      throw normalizeResourceDetailError(
        new Error("RESOURCE_NOT_FOUND"),
        undefined
      );
    }

    return {
      receipts: demoReceipts.filter((receipt) => receipt.resourceId === resourceId),
      requirement: buildPaymentRequirement(resource),
      resource,
      seller: findDemoSeller(resource.sellerId),
      source: "demo"
    };
  }

  try {
    const resource = await client.getResource(resourceId);

    return {
      receipts: [],
      requirement: buildPaymentRequirement(resource),
      resource,
      source: "api"
    };
  } catch (error) {
    throw normalizeResourceDetailError(error, isApiClientError(error) ? error.requestId : undefined);
  }
}

/**
 * Normalizes API errors to typed ResourceDetailError.
 * Distinguishes between 404 (not found), 503 (service unavailable), and other errors.
 */
function normalizeResourceDetailError(
  error: unknown,
  requestId?: string
): ResourceDetailError {
  // Check if it's an ApiClientError with specific codes
  if (isApiClientError(error)) {
    if (error.code === "RESOURCE_NOT_FOUND" || error.status === 404) {
      return {
        code: "NOT_FOUND",
        message: error.message
      };
    }

    if (error.code === "UNSUPPORTED_CAPABILITY" || error.status === 503) {
      return {
        code: "SERVICE_UNAVAILABLE",
        message: error.message,
        requestId: error.requestId
      };
    }

    if (error.code === "INVALID_API_RESPONSE") {
      return {
        code: "INVALID_RESPONSE",
        message: error.message,
        requestId: error.requestId
      };
    }

    // Other API errors (authorization, validation, server errors, etc.)
    return {
      code: "UNKNOWN_ERROR",
      message: error.message,
      requestId: error.requestId
    };
  }

  // Generic error or unknown type
  if (error instanceof Error) {
    return {
      code: "UNKNOWN_ERROR",
      message: error.message,
      requestId
    };
  }

  return {
    code: "UNKNOWN_ERROR",
    message: "An unknown error occurred while loading resource detail.",
    requestId
  };
}

function isApiClientError(error: unknown): error is ApiClientError {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    "status" in error &&
    "requestId" in error
  );
}

export function buildPaymentRequirement(resource: Resource): ResourcePaymentSummary {
  return {
    amount: resource.amount,
    assetCode: resource.assetCode,
    assetIssuer: resource.assetIssuer,
    extensions: resource.extensions,
    network: resource.network,
    payTo: resource.payTo,
    resourceId: resource.id
  };
}
