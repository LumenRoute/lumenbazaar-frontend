/**
 * Map application errors to bounded error categories for telemetry.
 * Errors are never forwarded raw; only bounded categories are emitted.
 */

import { ApiClientError } from "@/services/api/client";
import type { ErrorCategory, WalletErrorCode } from "./types";

/**
 * Map an error to a bounded error category.
 * Returns a category suitable for telemetry emission.
 */
export function mapErrorCategory(error: unknown): ErrorCategory {
  // Handle ApiClientError (from API requests)
  if (error instanceof ApiClientError) {
    return mapApiErrorToCategory(error);
  }

  // Handle standard Error
  if (error instanceof Error) {
    return mapErrorMessageToCategory(error.message, error.name);
  }

  // Handle network/fetch errors
  if (error instanceof TypeError) {
    // Common fetch errors
    if (error.message.includes("fetch") || error.message.includes("network")) {
      return "NETWORK_ERROR";
    }
    return "UNKNOWN_ERROR";
  }

  // Unknown error type
  return "UNKNOWN_ERROR";
}

/**
 * Map ApiClientError to a category based on HTTP status.
 */
function mapApiErrorToCategory(error: ApiClientError): ErrorCategory {
  const { status, code } = error;

  // 4xx client errors
  if (status >= 400 && status < 500) {
    if (status === 400) {
      // Bad request might indicate invalid signature or challenge
      if (code.includes("SIGNATURE") || code.includes("INVALID")) {
        return "INVALID_SIGNATURE";
      }
      return "VERIFICATION_FAILED";
    }
    if (status === 408) {
      return "VERIFICATION_TIMEOUT";
    }
    return "VERIFICATION_FAILED";
  }

  // 5xx server errors
  if (status >= 500) {
    return "VERIFICATION_FAILED";
  }

  // Network error (status 0 typically means network unreachable)
  if (status === 0) {
    return "NETWORK_ERROR";
  }

  return "UNKNOWN_ERROR";
}

/**
 * Map error message or error name to a category (heuristic).
 */
function mapErrorMessageToCategory(message: string, name: string): ErrorCategory {
  const lower = message.toLowerCase();

  // Timeout errors
  if (lower.includes("timeout") || name.includes("Timeout")) {
    return "VERIFICATION_TIMEOUT";
  }

  // Network errors
  if (
    lower.includes("network") ||
    lower.includes("offline") ||
    lower.includes("connect") ||
    name.includes("NetworkError")
  ) {
    return "NETWORK_ERROR";
  }

  // Signature errors
  if (lower.includes("signature") || lower.includes("sign")) {
    return "INVALID_SIGNATURE";
  }

  // Verification errors
  if (lower.includes("verify") || lower.includes("verification")) {
    return "VERIFICATION_FAILED";
  }

  return "UNKNOWN_ERROR";
}

/**
 * Map wallet-specific error codes to wallet error categories.
 */
export function mapWalletErrorCode(error: unknown): WalletErrorCode {
  if (typeof error === "string") {
    const lower = error.toLowerCase();
    if (lower.includes("user") || lower.includes("reject")) {
      return "WALLET_REJECTED";
    }
    if (lower.includes("timeout")) {
      return "WALLET_TIMEOUT";
    }
    if (lower.includes("not") || lower.includes("unavailable")) {
      return "WALLET_UNAVAILABLE";
    }
    if (lower.includes("network") || lower.includes("mismatch")) {
      return "WALLET_NETWORK_MISMATCH";
    }
    if (lower.includes("signature")) {
      return "SIGNATURE_INVALID";
    }
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes("user") || message.includes("reject")) {
      return "WALLET_REJECTED";
    }
    if (message.includes("timeout")) {
      return "WALLET_TIMEOUT";
    }
    if (message.includes("network") || message.includes("mismatch")) {
      return "WALLET_NETWORK_MISMATCH";
    }
  }

  // Default: wallet unavailable
  return "WALLET_UNAVAILABLE";
}
