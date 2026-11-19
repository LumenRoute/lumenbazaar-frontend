/**
 * Export and redaction utilities for safe response display and copying.
 * Handles sensitive data redaction before display and copy operations.
 */

import { isSensitivePaymentKey } from "@/services/ui-state";

export type RedactionConfig = {
  /** Maximum size in bytes before response is truncated */
  maxSize?: number;
  /** Whether to redact sensitive keys */
  redact?: boolean;
  /** Additional keys to redact beyond defaults */
  additionalRedactionKeys?: string[];
};

export const DEFAULT_REDACTION_CONFIG: RedactionConfig = {
  maxSize: 1024 * 1024, // 1MB
  redact: true,
  additionalRedactionKeys: []
};

/**
 * Redacts sensitive data from a value recursively.
 * Replaces values for keys matching sensitive patterns with [redacted].
 */
export function redactSensitiveData(
  value: unknown,
  additionalKeys: string[] = []
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveData(item, additionalKeys));
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      shouldRedactKey(key, additionalKeys) ? "[redacted]" : redactSensitiveData(entry, additionalKeys)
    ])
  );
}

/**
 * Checks if a key should be redacted based on sensitive patterns.
 */
export function shouldRedactKey(key: string, additionalKeys: string[] = []): boolean {
  // Use existing sensitive key checker from ui-state
  if (isSensitivePaymentKey(key)) {
    return true;
  }

  // Check additional redaction keys
  const normalized = key.toLowerCase();
  return additionalKeys.some((sensitiveKey) => normalized.includes(sensitiveKey.toLowerCase()));
}

/**
 * Formats a value for display with optional redaction.
 * Returns a pretty-printed string representation.
 */
export function formatResponseForDisplay(
  value: unknown,
  config: RedactionConfig = DEFAULT_REDACTION_CONFIG
): string {
  const { redact = true, additionalRedactionKeys = [] } = config;

  // Apply redaction if enabled
  let displayValue = value;
  if (redact) {
    displayValue = redactSensitiveData(value, additionalRedactionKeys);
  }

  // Format as JSON
  const formatted = typeof displayValue === "string" 
    ? displayValue 
    : JSON.stringify(displayValue, null, 2);

  return formatted;
}

/**
 * Formats a value for safe copying to clipboard.
 * Applies redaction and truncation as needed.
 */
export function formatResponseForCopy(
  value: unknown,
  config: RedactionConfig = DEFAULT_REDACTION_CONFIG
): { content: string; truncated: boolean; reason?: string } {
  const { maxSize = DEFAULT_REDACTION_CONFIG.maxSize, redact = true, additionalRedactionKeys = [] } = config;

  // Apply redaction if enabled
  let copyValue = value;
  if (redact) {
    copyValue = redactSensitiveData(value, additionalRedactionKeys);
  }

  // Format as JSON
  const formatted = typeof copyValue === "string" 
    ? copyValue 
    : JSON.stringify(copyValue, null, 2);

  // Check size limit
  const sizeInBytes = new TextEncoder().encode(formatted).length;
  if (sizeInBytes > (maxSize ?? Infinity)) {
    return {
      content: formatted.substring(0, maxSize),
      truncated: true,
      reason: `Response truncated: ${(sizeInBytes / 1024).toFixed(1)}KB exceeds ${((maxSize ?? 0) / 1024).toFixed(1)}KB limit`
    };
  }

  return {
    content: formatted,
    truncated: false
  };
}

/**
 * Estimates the display size of a response for UI rendering.
 * Returns size category and detailed breakdown.
 */
export function estimateResponseSize(value: unknown): {
  bytes: number;
  category: "small" | "medium" | "large" | "huge";
  canDisplay: boolean;
  displayLimit: number;
} {
  const formatted = typeof value === "string" 
    ? value 
    : JSON.stringify(value);

  const bytes = new TextEncoder().encode(formatted).length;
  const displayLimit = 1024 * 1024; // 1MB display limit

  return {
    bytes,
    category: 
      bytes < 10 * 1024 ? "small" :
      bytes < 100 * 1024 ? "medium" :
      bytes < 1024 * 1024 ? "large" :
      "huge",
    canDisplay: bytes < displayLimit,
    displayLimit
  };
}

/**
 * Validates response data structure and detects malformed responses.
 */
export function validateResponseStructure(value: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check if value is defined
  if (value === undefined) {
    errors.push("Response is undefined");
  }

  // Check for circular references
  try {
    JSON.stringify(value);
  } catch (e) {
    if (e instanceof Error && e.message.includes("circular")) {
      errors.push("Response contains circular references");
    } else if (e instanceof Error) {
      errors.push(`Response is not JSON serializable: ${e.message}`);
    }
  }

  // Check for extremely large strings
  if (typeof value === "string" && value.length > 10 * 1024 * 1024) {
    errors.push("Response contains extremely large string (>10MB)");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Truncates a response to a safe display size for preview.
 * Used for initial rendering to prevent page freeze.
 */
export function truncateForPreview(
  value: unknown,
  previewLines: number = 50
): { content: string; truncated: boolean; totalLines: number } {
  const formatted = typeof value === "string" 
    ? value 
    : JSON.stringify(value, null, 2);

  const lines = formatted.split("\n");
  const totalLines = lines.length;

  if (lines.length > previewLines) {
    const preview = lines.slice(0, previewLines).join("\n");
    return {
      content: preview,
      truncated: true,
      totalLines
    };
  }

  return {
    content: formatted,
    truncated: false,
    totalLines
  };
}
