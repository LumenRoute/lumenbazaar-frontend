/**
 * Event allowlist and bounded field definitions.
 * Defines exactly which fields are allowed per event type and their bounds.
 * All other fields are silently dropped (not forwarded).
 */

import type { TelemetryEventType } from "./types";

/**
 * Allowlisted fields per event type.
 * Only these fields will be extracted and validated.
 */
export const EVENT_ALLOWLIST: Record<TelemetryEventType, string[]> = {
  wallet_connect_attempt: ["status", "errorCode"],
  wallet_connect_success: [],
  payment_verification_attempted: ["resourceType", "assetCode"],
  payment_verification_succeeded: ["duration_ms"],
  payment_verification_failed: ["errorCategory", "duration_ms"],
  payment_authorization_initiated: [],
  payment_authorized: ["duration_ms"],
  payment_authorization_failed: ["errorCategory", "duration_ms"],
  resource_fetch_attempted: ["resourceType"],
  resource_fetch_succeeded: ["duration_ms"],
  resource_fetch_failed: ["errorCategory", "duration_ms"],
  settlement_initiated: [],
  settlement_completed: ["duration_ms"],
  settlement_failed: ["errorCategory", "duration_ms"],
  ui_error_displayed: ["errorCategory", "source"],
  app_initialized: ["telemetryEnabled", "consentStatus"]
};

/**
 * Bounded field definitions. Each field has type, min, max, enum values, or length constraints.
 */
export const FIELD_BOUNDS = {
  // Integer bounds (milliseconds, counts, etc.)
  duration_ms: { min: 0, max: 300000 }, // 5 minutes max
  
  // String bounds
  assetCode: { maxLength: 12, pattern: /^[A-Za-z0-9]*$/ }, // alphanumeric, max 12 chars
  source: { maxLength: 50, pattern: /^[A-Za-z0-9_]*$/ }, // alphanumeric + underscore, max 50 chars
  
  // Enums
  status: ["initiated"],
  errorCode: [
    "WALLET_REJECTED",
    "WALLET_TIMEOUT",
    "WALLET_UNAVAILABLE",
    "SIGNATURE_INVALID",
    "WALLET_NETWORK_MISMATCH"
  ],
  errorCategory: [
    "INVALID_SIGNATURE",
    "VERIFICATION_TIMEOUT",
    "VERIFICATION_FAILED",
    "NETWORK_ERROR",
    "RESOURCE_TIMEOUT",
    "RESOURCE_FETCH_FAILED",
    "SETTLEMENT_FAILED",
    "UNKNOWN_ERROR"
  ],
  resourceType: ["service", "data"],
  telemetryEnabled: ["boolean"],
  consentStatus: ["enabled", "disabled_by_config", "disabled_by_consent", "no_consent_given"]
} as const;

/**
 * Validate that a value conforms to its bound definition.
 * Returns null if valid, error message if invalid.
 */
export function validateFieldBound(fieldName: string, value: unknown): string | null {
  const bound = (FIELD_BOUNDS as Record<string, unknown>)[fieldName];
  
  if (!bound) {
    // Field not in bounds definition, but may be allowed (this should not happen if EVENT_ALLOWLIST is correct)
    return null;
  }

  // Handle enum bounds
  if (Array.isArray(bound)) {
    if (!bound.includes(value)) {
      return `Field "${fieldName}" value "${value}" not in allowed enum: [${bound.join(", ")}]`;
    }
    return null;
  }

  // Handle object bounds (integer, string)
  if (typeof bound === "object" && bound !== null) {
    const boundsObj = bound as Record<string, unknown>;

    // Integer bounds
    if ("min" in boundsObj || "max" in boundsObj) {
      if (typeof value !== "number" || !Number.isInteger(value)) {
        return `Field "${fieldName}" must be an integer, got ${typeof value}`;
      }
      if ("min" in boundsObj && value < (boundsObj.min as number)) {
        return `Field "${fieldName}" value ${value} is below minimum ${boundsObj.min}`;
      }
      if ("max" in boundsObj && value > (boundsObj.max as number)) {
        return `Field "${fieldName}" value ${value} exceeds maximum ${boundsObj.max}`;
      }
    }

    // String bounds
    if ("maxLength" in boundsObj || "pattern" in boundsObj) {
      if (typeof value !== "string") {
        return `Field "${fieldName}" must be a string, got ${typeof value}`;
      }
      if ("maxLength" in boundsObj && value.length > (boundsObj.maxLength as number)) {
        return `Field "${fieldName}" length ${value.length} exceeds maximum ${boundsObj.maxLength}`;
      }
      if ("pattern" in boundsObj) {
        const pattern = boundsObj.pattern as RegExp;
        if (!pattern.test(value)) {
          return `Field "${fieldName}" value "${value}" does not match pattern ${pattern}`;
        }
      }
    }
  }

  return null;
}

/**
 * Check if a field is in the allowlist for a given event type.
 */
export function isFieldAllowed(eventType: TelemetryEventType, fieldName: string): boolean {
  return EVENT_ALLOWLIST[eventType]?.includes(fieldName) ?? false;
}

/**
 * Get all allowed fields for an event type.
 */
export function getAllowedFields(eventType: TelemetryEventType): string[] {
  return EVENT_ALLOWLIST[eventType] ?? [];
}

/**
 * Maximum payload size (bytes) to prevent oversized events.
 */
export const MAX_EVENT_PAYLOAD_SIZE = 10 * 1024; // 10 KB
