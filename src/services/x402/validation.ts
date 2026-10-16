/**
 * x402 v2 Payment Challenge Validation Utilities
 *
 * Strict format validation for x402 v2 payment requirements:
 * - Stellar address formats (classic G*, muxed M*, contract C*)
 * - Soroban contract ID validation
 * - Network ID validation
 * - Amount atomic unit validation
 * - Timeout and currency code validation
 *
 * These validators enforce the x402 v2 protocol requirements and fail closed
 * on ambiguous or malformed inputs.
 */

/**
 * Validate a classic Stellar public address (G*) or muxed address (M*).
 *
 * Valid recipients for payments must be:
 * - Classic account: G followed by 55 base32 characters (56 total, 32 bytes when decoded)
 * - Muxed account: M followed by 55 base32 characters (56 total, with embedded 64-bit ID)
 *
 * @param address - The address to validate
 * @returns true if address is a valid classic or muxed account address
 *
 * @remarks
 * Rejects:
 * - Contract addresses (start with C)
 * - Invalid base32 encoding
 * - Wrong length
 * - Empty/null/non-string values
 *
 * @example
 * ```typescript
 * isValidStellarAccountAddress("GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE"); // true
 * isValidStellarAccountAddress("MBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE"); // true (muxed)
 * isValidStellarAccountAddress("CB256KDRXDO2FYJN3YBYZE5KCU46WIIE67DRP5T7HI45DRH2GM6YOJFS"); // false (contract)
 * ```
 */
export function isValidStellarAccountAddress(address: string): boolean {
  if (typeof address !== "string") {
    return false;
  }

  // Stellar addresses (classic or muxed) are exactly 56 characters
  if (address.length !== 56) {
    return false;
  }

  // Must start with G (classic account) or M (muxed account)
  const prefix = address[0];
  if (prefix !== "G" && prefix !== "M") {
    return false;
  }

  // Remaining characters must be base32: A-Z and 2-7
  // Base32 uses [A-Z2-7] per RFC 4648
  return /^[GM][A-Z2-7]{55}$/.test(address);
}

/**
 * Validate a Soroban contract ID (C*).
 *
 * Valid contract IDs for asset payments must be:
 * - Start with C (Soroban contract prefix)
 * - 56 characters total (same as account addresses)
 * - Base32 encoded (A-Z and 2-7)
 *
 * @param contractId - The contract ID to validate
 * @returns true if contractId is a valid Soroban contract address
 *
 * @remarks
 * Rejects:
 * - Account addresses (start with G or M)
 * - Invalid base32 encoding
 * - Wrong length
 * - Empty/null/non-string values
 *
 * @example
 * ```typescript
 * isValidSorobanContractId("CB256KDRXDO2FYJN3YBYZE5KCU46WIIE67DRP5T7HI45DRH2GM6YOJFS"); // true
 * isValidSorobanContractId("GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE"); // false (account)
 * isValidSorobanContractId("not-a-contract"); // false
 * ```
 */
export function isValidSorobanContractId(contractId: string): boolean {
  if (typeof contractId !== "string") {
    return false;
  }

  // Soroban contract IDs are exactly 56 characters
  if (contractId.length !== 56) {
    return false;
  }

  // Must start with C (Soroban contract prefix)
  if (!contractId.startsWith("C")) {
    return false;
  }

  // Remaining characters must be base32: A-Z and 2-7
  // Base32 uses [A-Z2-7] per RFC 4648
  return /^C[A-Z2-7]{55}$/.test(contractId);
}

/**
 * Validate a payment amount in atomic units.
 *
 * Valid amounts must be:
 * - Positive integer (no decimals, no negative values, no zero)
 * - No leading zeros (except the single digit "1" through "9")
 * - String representation of atomic units
 *
 * @param amount - The amount string to validate
 * @returns true if amount is a valid positive integer without leading zeros
 *
 * @remarks
 * Rejects:
 * - Zero or negative values
 * - Decimal points
 * - Leading zeros ("0123" invalid, "123" valid)
 * - Non-numeric characters
 * - Empty/null/non-string values
 *
 * Matches regex: /^[1-9]\d*$/
 *
 * @example
 * ```typescript
 * isValidAtomicAmount("500000"); // true (0.50 with 7 decimals)
 * isValidAtomicAmount("1"); // true (minimum atomic unit)
 * isValidAtomicAmount("0"); // false (not positive)
 * isValidAtomicAmount("0500000"); // false (leading zero)
 * isValidAtomicAmount("500000.5"); // false (decimal)
 * ```
 */
export function isValidAtomicAmount(amount: string): boolean {
  if (typeof amount !== "string") {
    return false;
  }

  // Must match: one non-zero digit followed by zero or more digits
  // Rejects: 0, 00, 01, 001, 123.45, -123, "", null, etc.
  return /^[1-9]\d*$/.test(amount);
}

/**
 * Validate a network ID.
 *
 * Valid networks for x402 v2 exact payments:
 * - "stellar:testnet" - Stellar test network
 * - "stellar:pubnet" - Stellar production network
 *
 * @param network - The network ID to validate
 * @returns true if network is "stellar:testnet" or "stellar:pubnet"
 *
 * @remarks
 * Rejects any other network identifier, including:
 * - Other blockchains (ethereum:*, bitcoin:*, etc.)
 * - Typos (stellar:test, stellar:public, etc.)
 * - Empty/null/non-string values
 *
 * @example
 * ```typescript
 * isValidNetworkId("stellar:testnet"); // true
 * isValidNetworkId("stellar:pubnet"); // true
 * isValidNetworkId("stellar:public"); // false (typo)
 * isValidNetworkId("ethereum:mainnet"); // false
 * ```
 */
export function isValidNetworkId(network: string): boolean {
  if (typeof network !== "string") {
    return false;
  }

  return network === "stellar:testnet" || network === "stellar:pubnet";
}

/**
 * Validate a payment timeout in seconds.
 *
 * Valid timeouts must be:
 * - Positive integer (no decimals, no negative, no zero)
 * - Reasonably bounded (1 second to 1 week = 604,800 seconds)
 *
 * @param timeoutSeconds - The timeout value to validate
 * @param maxSeconds - Optional maximum allowed timeout (default: 604,800 = 1 week)
 * @returns true if timeout is a positive integer within bounds
 *
 * @remarks
 * Rejects:
 * - Zero or negative values
 * - Non-integer values (floats)
 * - Values exceeding bounds (prevents DoS timeout inflation)
 * - Non-number values
 *
 * Default maximum is 1 week (604,800 seconds) per x402 v2 recommendations.
 *
 * @example
 * ```typescript
 * isValidTimeoutSeconds(300); // true (5 minutes)
 * isValidTimeoutSeconds(60); // true (1 minute)
 * isValidTimeoutSeconds(1); // true (edge case: 1 second)
 * isValidTimeoutSeconds(0); // false (not positive)
 * isValidTimeoutSeconds(300.5); // false (not integer)
 * isValidTimeoutSeconds(999_999_999); // false (exceeds 1 week max)
 * ```
 */
export function isValidTimeoutSeconds(
  timeoutSeconds: number,
  maxSeconds = 604_800
): boolean {
  if (typeof timeoutSeconds !== "number") {
    return false;
  }

  // Must be a positive integer
  if (!Number.isInteger(timeoutSeconds)) {
    return false;
  }

  // Must be at least 1 second
  if (timeoutSeconds <= 0) {
    return false;
  }

  // Must not exceed maximum (prevent DoS timeout inflation)
  if (timeoutSeconds > maxSeconds) {
    return false;
  }

  return true;
}

/**
 * Validate a Stellar asset code.
 *
 * Valid asset codes:
 * - Alphanumeric (letters and digits only)
 * - 1-12 characters long
 * - Uppercase (by convention, but lowercase accepted)
 *
 * @param code - The asset code to validate
 * @returns true if code is a valid Stellar asset code
 *
 * @remarks
 * Rejects:
 * - Empty string
 * - Longer than 12 characters
 * - Non-alphanumeric characters
 * - Non-string values
 *
 * Stellar asset codes are typically uppercase (USDC, BRL, etc.)
 * but the protocol accepts any alphanumeric value.
 *
 * @example
 * ```typescript
 * isValidAssetCode("USDC"); // true
 * isValidAssetCode("EUR"); // true
 * isValidAssetCode("native"); // true (lowercase accepted)
 * isValidAssetCode("X"); // true (1 char minimum)
 * isValidAssetCode(""); // false (empty)
 * isValidAssetCode("TOOLONGCODE123"); // false (>12 chars)
 * isValidAssetCode("USD-C"); // false (hyphen not allowed)
 * ```
 */
export function isValidAssetCode(code: string): boolean {
  if (typeof code !== "string") {
    return false;
  }

  // Must be 1-12 characters
  if (code.length === 0 || code.length > 12) {
    return false;
  }

  // Must be alphanumeric
  return /^[a-zA-Z0-9]+$/.test(code);
}

/**
 * Validate an absolute HTTP/HTTPS URL.
 *
 * Valid URLs for x402 v2 resources:
 * - Must be absolute (start with http:// or https://)
 * - Must parse as valid URL
 * - Relative URLs are rejected
 *
 * @param url - The URL to validate
 * @returns true if url is a valid absolute HTTP(S) URL
 *
 * @remarks
 * Rejects:
 * - Relative URLs (/path, ../resource)
 * - Invalid URL syntax
 * - Non-HTTP protocols (ftp://, file://, etc.)
 * - Empty/null/non-string values
 *
 * Uses URL parsing to ensure syntax validity.
 *
 * @example
 * ```typescript
 * isValidAbsoluteUrl("https://api.example.com/resource"); // true
 * isValidAbsoluteUrl("http://localhost:8080/test"); // true
 * isValidAbsoluteUrl("/relative/path"); // false (relative)
 * isValidAbsoluteUrl("api.example.com"); // false (missing protocol)
 * isValidAbsoluteUrl("ftp://example.com"); // false (not HTTP)
 * isValidAbsoluteUrl("not-a-url"); // false
 * ```
 */
export function isValidAbsoluteUrl(url: string): boolean {
  if (typeof url !== "string") {
    return false;
  }

  try {
    const parsed = new URL(url);
    // Only accept HTTP and HTTPS protocols
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Summary of validation utilities:
 *
 * - isValidStellarAccountAddress(address: string): Validates G* or M* addresses
 * - isValidSorobanContractId(contractId: string): Validates C* contract addresses
 * - isValidAtomicAmount(amount: string): Validates positive integer amounts
 * - isValidNetworkId(network: string): Validates network identifiers
 * - isValidTimeoutSeconds(seconds: number): Validates positive integer timeouts
 * - isValidAssetCode(code: string): Validates 1-12 alphanumeric asset codes
 * - isValidAbsoluteUrl(url: string): Validates absolute HTTP(S) URLs
 *
 * All validators:
 * - Fail closed on invalid input
 * - Return boolean (true/false, never throw)
 * - Handle type mismatches gracefully
 * - Follow x402 v2 protocol requirements
 */
