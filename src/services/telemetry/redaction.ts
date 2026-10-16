/**
 * Sensitive data detection and redaction.
 * Defense in depth: combines allowlist validation + pattern detection.
 */

/**
 * Keywords that identify sensitive data (case-insensitive).
 * If a key contains any of these, the value is considered sensitive.
 */
const SENSITIVE_KEYS = [
  "authorization",
  "paymentpayload",
  "privatekey",
  "secret",
  "signature",
  "signedxdr",
  "walletaddress",
  "xdr",
  "seedphrase",
  "account",
  "receipt",
  "receiptid",
  "correlationid",
  "nonce",
  "payload"
];

/**
 * Patterns that indicate sensitive data in string values.
 */
const SENSITIVE_PATTERNS = [
  // Stellar address (32 chars base32-like: G[A-Z2-7]{55})
  /^G[A-Z2-7]{55}$/,
  
  // Stellar private key (S[A-Z2-7]{55})
  /^S[A-Z2-7]{55}$/,
  
  // Signature or transaction hash (128+ hex chars)
  /^[A-F0-9]{128,}$/i,
  
  // Transaction hash (64 hex chars)
  /^[A-F0-9]{64}$/i,
  
  // Authorization or signature headers
  /(authorization|x-payment-signature):/i,
  
  // Generic bearer token pattern
  /\bbearer\s+[A-Za-z0-9._-]+/i,
  
  // JWT-like pattern (three base64 parts separated by dots)
  /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
];

/**
 * Check if a key name indicates sensitive data.
 */
function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEYS.some((sensitiveKey) => normalized.includes(sensitiveKey));
}

/**
 * Check if a string value matches any sensitive pattern.
 */
function containsSensitivePattern(value: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Recursively detect sensitive data in an object, array, or value.
 * Returns true if sensitive data found anywhere in the structure.
 */
export function containsSensitiveData(value: unknown): boolean {
  // Check primitives
  if (typeof value === "string") {
    return containsSensitivePattern(value);
  }

  if (typeof value !== "object" || value === null) {
    return false;
  }

  // Check arrays
  if (Array.isArray(value)) {
    return value.some((item) => containsSensitiveData(item));
  }

  // Check objects
  for (const [key, val] of Object.entries(value)) {
    // Sensitive key?
    if (isSensitiveKey(key)) {
      return true;
    }
    
    // Sensitive nested value?
    if (containsSensitiveData(val)) {
      return true;
    }
  }

  return false;
}

/**
 * Create a safe diagnostic string for logging sensitive data rejection (no secrets leaked).
 */
export function createSensitiveDataRejectionDiagnostic(value: unknown): string {
  if (typeof value === "string") {
    return `string matching sensitive pattern: ${value.substring(0, 20)}...`;
  }

  if (typeof value !== "object" || value === null) {
    return `value of type ${typeof value}`;
  }

  if (Array.isArray(value)) {
    return `array containing ${value.length} item(s)`;
  }

  const keys = Object.keys(value);
  const sensitiveKeys = keys.filter((k) => isSensitiveKey(k));
  if (sensitiveKeys.length > 0) {
    return `object containing sensitive key(s): ${sensitiveKeys.join(", ")}`;
  }

  return `object with nested sensitive data`;
}
