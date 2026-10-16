# x402 v2 Payment Challenge Protocol

## Overview

The frontend implements strict x402 v2 payment challenge parsing and validation. This document specifies the required fields, format constraints, and validation rules for payment challenges.

**Dependency**: `@x402/core@^2.0.0`  
**Specification**: [x402 v2 Final Spec](https://github.com/stellar/x402-spec)  
**Scope**: Exact scheme only (`scheme: "exact"`)

## Payment Challenge Structure

### Challenge Response (402 Payment Required)

The backend returns a 402 response with a `PAYMENT-REQUIRED` header containing a JSON challenge:

```typescript
{
  "x402Version": 2,
  "accepts": [
    {
      "scheme": "exact",
      "network": "stellar:testnet",
      "asset": "CB256KDRXDO2FYJN3YBYZE5KCU46WIIE67DRP5T7HI45DRH2GM6YOJFS",
      "amount": "500000",
      "payTo": "GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE",
      "maxTimeoutSeconds": 300,
      "extra": {
        "assetCode": "USDC",
        "assetIssuer": "GBUQWP3BOUZX34ULNQG23RQ6F4BFXWBXMODWQCDNYCD3MHALB5O6OVY"
      }
    }
  ],
  "resource": {
    "url": "https://api.example.com/resource",
    "description": "Resource description",
    "iconUrl": "https://api.example.com/icon.png",
    "serviceName": "Service Name",
    "mimeType": "application/json",
    "tags": ["tag1", "tag2"]
  },
  "error": "Optional error message explaining why payment is required",
  "extensions": {
    "x-custom-field": "value"
  }
}
```

## Required Fields

All required fields must be present and valid. Validation fails closed on missing or malformed fields.

### `x402Version` (literal `2`)

- **Type**: Literal `2`
- **Requirement**: Exact match
- **Validation**: Enforced via Zod schema
- **Invalid examples**: `1`, `"2"`, `2.0`

```typescript
// ✓ Valid
{ x402Version: 2 }

// ✗ Invalid
{ x402Version: 1 }        // Wrong version
{ x402Version: "2" }      // Wrong type
```

### `accepts` (array of exact payment requirements)

- **Type**: Array of objects
- **Minimum length**: 1
- **Scheme filter**: Only `scheme: "exact"` entries are processed
- **Validation**: Each requirement is validated separately

The client filters the accepts array to only `scheme: "exact"` entries and rejects challenges with no exact options.

```typescript
// ✓ Valid (exact scheme present)
{
  "accepts": [
    { "scheme": "exact", ... },
    { "scheme": "upto", ... }  // Also present, ignored
  ]
}

// ✗ Invalid (no exact scheme)
{
  "accepts": [
    { "scheme": "upto", ... }
  ]
}

// ✗ Invalid (empty array)
{
  "accepts": []
}
```

### `resource` (object with URL and optional metadata)

- **Type**: Object
- **`url`** (required):
  - Absolute HTTP(S) URL
  - Validated via `isValidAbsoluteUrl()`
  - Must match the requested resource URL
  - **Invalid examples**: relative paths, non-HTTP protocols, malformed syntax
- **`description`** (optional): String describing the resource
- **`iconUrl`** (optional): Absolute HTTP(S) URL to resource icon
- **`serviceName`** (optional): Human-readable service name
- **`mimeType`** (optional): MIME type of resource (e.g., `application/json`)
- **`tags`** (optional): Array of string tags

```typescript
// ✓ Valid (required url only)
{
  "resource": {
    "url": "https://api.example.com/resource"
  }
}

// ✓ Valid (with optional metadata)
{
  "resource": {
    "url": "https://api.example.com/resource",
    "description": "Current weather",
    "iconUrl": "https://api.example.com/icon.png",
    "serviceName": "Weather API",
    "mimeType": "application/json",
    "tags": ["weather", "real-time"]
  }
}

// ✗ Invalid (relative URL)
{
  "resource": {
    "url": "/resource"
  }
}

// ✗ Invalid (malformed URL)
{
  "resource": {
    "url": "not-a-url"
  }
}
```

### Optional Fields

#### `error` (string)

Optional error message explaining why payment is required. Displayed to the user but does not affect validation.

```typescript
// ✓ Valid
{
  "error": "Premium API tier requires payment. Free tier limit exceeded."
}

// ✓ Valid (omitted)
{
  // no error field
}
```

#### `extensions` (object)

Unknown extensions are preserved without validation. Allows protocol evolution and extensibility.

```typescript
// ✓ Valid (any structure preserved)
{
  "extensions": {
    "x-rate-limit-after-payment": "10000",
    "x-subscription-tiers": ["free", "pro", "enterprise"],
    "x-custom-feature": { "nested": true }
  }
}

// ✓ Valid (omitted)
{
  // no extensions field
}

// ✓ Valid (null)
{
  "extensions": null
}
```

## Exact Payment Requirement Fields

Each requirement in the `accepts` array must satisfy these constraints.

### `scheme` (literal `"exact"`)

- **Type**: Literal string `"exact"`
- **Validation**: Enforced via Zod schema
- **Requirement**: Exact match (case-sensitive)
- **Invalid examples**: `"upto"`, `"Exact"`, `undefined`

```typescript
// ✓ Valid
{ "scheme": "exact" }

// ✗ Invalid
{ "scheme": "upto" }
{ "scheme": "Exact" }
```

### `network` (Stellar network identifier)

- **Type**: Enum: `"stellar:testnet"` | `"stellar:pubnet"`
- **Validation**: `isValidNetworkId()`
- **Requirements**: Exact match (case-sensitive), colon-separated format
- **Invalid examples**: `"stellar:public"`, `"ethereum:mainnet"`, `"stellar"`, typos

The frontend selects the requirement matching the wallet's configured network. Challenges must offer payment options for all supported networks.

```typescript
// ✓ Valid
{ "network": "stellar:testnet" }
{ "network": "stellar:pubnet" }

// ✗ Invalid
{ "network": "stellar:public" }      // Typo
{ "network": "stellar" }             // Missing network name
{ "network": "Stellar:testnet" }     // Wrong case
{ "network": "ethereum:mainnet" }    // Wrong blockchain
```

### `asset` (Soroban contract ID)

- **Type**: String (56 characters, base32-encoded)
- **Format**: Starts with `C` (Soroban contract), followed by 55 base32 characters
- **Validation**: `isValidSorobanContractId()`
- **Requirements**: Exact length, valid base32 alphabet (A-Z, 2-7 only; no 0, 1, 8, 9)
- **Invalid examples**: account addresses (G*), malformed, wrong length

The asset field identifies the Soroban token contract being charged. Must be deployed on the specified network.

```typescript
// ✓ Valid (Soroban contract)
{ "asset": "CB256KDRXDO2FYJN3YBYZE5KCU46WIIE67DRP5T7HI45DRH2GM6YOJFS" }

// ✗ Invalid (account address instead of contract)
{ "asset": "GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE" }

// ✗ Invalid (malformed base32)
{ "asset": "CB256KDRXDO2FYJN3YBYZE5KCU46WIIE67DRP5T7HI45DRH2GM6YO0FS" }  // Contains 0

// ✗ Invalid (wrong length)
{ "asset": "CB256KDRXDO2FYJN3YBYZE5KCU46WIIE67DRP5T7HI45DRH2GM6YOJF" }  // 55 chars
```

### `amount` (atomic units)

- **Type**: String (positive integer, no decimals)
- **Format**: One or more non-zero digits: `[1-9]\d*`
- **Validation**: `isValidAtomicAmount()`
- **Requirements**: Positive integer only, no leading zeros, no decimals
- **Interpretation**: Atomic units based on asset decimals (e.g., 500000 = 0.50 with 7 decimals)
- **Invalid examples**: `"0"`, `"0.5"`, `"000"`, `"-500000"`, `"500000.5"`

Amounts represent the smallest divisible unit of the asset (atomic units). The backend determines atomic units based on the asset's decimal precision. Clients never send decimals; amounts are already in atomic form.

```typescript
// ✓ Valid (positive integers)
{ "amount": "1" }           // Minimum: 1 atomic unit
{ "amount": "500000" }      // Standard: 0.50 with 7 decimals
{ "amount": "10000000000000" }  // Large: 1 trillion atomic units

// ✗ Invalid (zero)
{ "amount": "0" }

// ✗ Invalid (leading zeros)
{ "amount": "0500000" }

// ✗ Invalid (decimals in atomic form)
{ "amount": "0.5" }

// ✗ Invalid (negative)
{ "amount": "-500000" }

// ✗ Invalid (non-numeric)
{ "amount": "500000abc" }
```

### `payTo` (recipient account address)

- **Type**: String (56 characters, base32-encoded)
- **Format**: Starts with `G` (classic account) or `M` (muxed account), followed by 55 base32 characters
- **Validation**: `isValidStellarAccountAddress()`
- **Requirements**: Exact length, valid base32 alphabet (A-Z, 2-7 only; no 0, 1, 8, 9)
- **Recipient type**: Must be an account address (not a contract)
- **Invalid examples**: contract addresses (C*), malformed, wrong length

The payTo field identifies where the payment should be sent. Must be a valid Stellar account that can receive payments.

```typescript
// ✓ Valid (classic account)
{ "payTo": "GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE" }

// ✓ Valid (muxed account)
{ "payTo": "MBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE" }

// ✗ Invalid (contract address)
{ "payTo": "CB256KDRXDO2FYJN3YBYZE5KCU46WIIE67DRP5T7HI45DRH2GM6YOJFS" }

// ✗ Invalid (malformed)
{ "payTo": "not-a-valid-address" }

// ✗ Invalid (wrong length)
{ "payTo": "GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQ" }  // 55 chars
```

### `maxTimeoutSeconds` (challenge validity window)

- **Type**: Integer (positive)
- **Format**: Positive integer: `1 ≤ value ≤ 604,800` (1 second to 1 week)
- **Validation**: `isValidTimeoutSeconds()`
- **Requirements**: Integer only, positive, bounded by 1 week default
- **Interpretation**: Challenge must be settled within this many seconds from receipt
- **Invalid examples**: `0`, `-300`, `300.5`, `999_999_999`

The timeout determines the challenge validity window. The client calculates expiry as `receivedAt + maxTimeoutSeconds * 1000` milliseconds.

```typescript
// ✓ Valid (edge: 1 second)
{ "maxTimeoutSeconds": 1 }

// ✓ Valid (typical: 5 minutes)
{ "maxTimeoutSeconds": 300 }

// ✓ Valid (edge: 1 week)
{ "maxTimeoutSeconds": 604_800 }

// ✗ Invalid (zero)
{ "maxTimeoutSeconds": 0 }

// ✗ Invalid (negative)
{ "maxTimeoutSeconds": -300 }

// ✗ Invalid (float)
{ "maxTimeoutSeconds": 300.5 }

// ✗ Invalid (exceeds 1 week)
{ "maxTimeoutSeconds": 1_000_000 }
```

### `extra` (preserved without validation)

- **Type**: Object (record)
- **Format**: Any structure of unknown fields
- **Validation**: None; preserved as-is
- **Normalization**: `null` is normalized to `{}`
- **Purpose**: Extensibility and protocol evolution

The extra field preserves backend metadata without frontend validation. Common fields include asset code, asset issuer, and custom metadata.

```typescript
// ✓ Valid (normalized to empty object)
{ "extra": null }

// ✓ Valid (with metadata preserved)
{
  "extra": {
    "assetCode": "USDC",
    "assetIssuer": "GBUQWP3BOUZX34ULNQG23RQ6F4BFXWBXMODWQCDNYCD3MHALB5O6OVY",
    "customField": "value"
  }
}

// ✓ Valid (any structure preserved)
{
  "extra": {
    "nested": { "deep": { "structure": "value" } },
    "arrays": [1, 2, 3]
  }
}

// ✓ Valid (omitted, normalized to {})
{
  // no extra field
}
```

## Validation Rules

### Fail-Closed Validation

All validation is **fail-closed**: ambiguous or invalid input is rejected rather than assumed or coerced.

- No type coercion (e.g., string `"300"` is not coerced to number `300`)
- No default values (missing required fields are rejected)
- No lenient parsing (malformed syntax is rejected)
- Clear error messages cite the specific constraint violated

### Critical Field Mutations

The frontend detects if payment terms change between challenge requests:

```typescript
// Fingerprint includes: amount, asset, network, payTo, maxTimeoutSeconds, scheme, resourceUrl
const fingerprint = JSON.stringify({
  amount: requirement.amount,
  asset: requirement.asset,
  network: requirement.network,
  payTo: requirement.payTo,
  maxTimeoutSeconds: requirement.maxTimeoutSeconds,
  scheme: requirement.scheme,
  resourceUrl: canonicalUrl(resourceUrl)
});
```

If a subsequent challenge returns a different fingerprint, the client rejects the challenge as mutated. This prevents replay of stale authorization.

### Challenge Freshness

Challenge expiry is calculated as:

```
expiresAt = receivedAt + (maxTimeoutSeconds * 1000)
```

The client verifies challenge freshness at:
1. Challenge request (immediately after receipt)
2. Authorization (before wallet prompt)
3. Settlement (before sending to backend)

If `now >= expiresAt`, the challenge is expired and rejected.

### URL Canonicalization

All URLs are canonicalized to absolute form using `new URL().toString()`:

```typescript
// Both canonicalize to the same value
"https://api.example.com/resource"
"https://api.example.com:443/resource"  // Explicit HTTPS port

// The resourceUrl must match the challenge response resource.url
if (canonicalUrl(challenge.resource.url) !== canonicalUrl(expected.resourceUrl)) {
  throw new ChallengeError("CHALLENGE_MISMATCH", "...");
}
```

## Implementation Files

- **Validation utilities**: `src/services/x402/validation.ts`
  - `isValidStellarAccountAddress(address: string): boolean`
  - `isValidSorobanContractId(contractId: string): boolean`
  - `isValidAtomicAmount(amount: string): boolean`
  - `isValidNetworkId(network: string): boolean`
  - `isValidTimeoutSeconds(seconds: number): boolean`
  - `isValidAssetCode(code: string): boolean`
  - `isValidAbsoluteUrl(url: string): boolean`

- **Schema definitions**: `src/services/api/schemas.ts`
  - `exactPaymentRequirementsSchema`: Zod validator with refinements
  - `paymentRequiredV2Schema`: Full challenge structure
  - `paymentResourceSchema`: Resource metadata

- **Challenge parsing**: `src/services/x402/challenge.ts`
  - `requestPaymentChallenge()`: Fetch and validate challenge
  - `expectedTermsForResource()`: Derive expected terms from resource
  - `assertChallengeFresh()`: Verify challenge is not expired
  - `challengeFingerprint()`: Compute challenge fingerprint

- **Test fixtures**: `src/services/x402/x402-v2-fixtures.ts`
  - 39 fixtures covering valid, invalid, and edge cases
  - All fixtures documented with validation notes

- **Test suites**:
  - `src/services/x402/validation.test.ts`: 80+ tests for validators
  - `src/services/x402/x402-v2-schema.test.ts`: 50+ tests for schema parsing
  - `tests/e2e/x402-v2-payment-challenges.spec.ts`: 30+ E2E tests

## Error Codes

Challenge parsing can raise `ChallengeError` with these codes:

- `CHALLENGE_MISSING`: 402 response without PAYMENT-REQUIRED header
- `CHALLENGE_MALFORMED`: Header cannot be decoded or parsed
- `CHALLENGE_UNSUPPORTED`: No exact scheme, network, or asset available
- `CHALLENGE_MISMATCH`: Terms don't match resource or URL changed
- `CHALLENGE_CHANGED`: Fingerprint differs from previous challenge
- `CHALLENGE_EXPIRED`: Challenge timeout exceeded
- `CHALLENGE_NOT_REQUIRED`: Resource returned success (not 402)
- `CHALLENGE_REQUEST_FAILED`: Network error during challenge request

## Summary

x402 v2 exact scheme validation is strict and fail-closed:

✓ **Valid challenges** parse successfully with all required fields  
✓ **Malformed fields** fail with specific error messages  
✓ **Extensions** are preserved without weakening validation  
✓ **Critical mutations** are detected via fingerprinting  
✓ **Timeouts** are enforced at request, authorization, and settlement  
✓ **Network IDs** support only Stellar testnet and pubnet  
✓ **Amounts** are atomic units only (no decimals)  
✓ **Assets** must be Soroban contracts (C*)  
✓ **Recipients** must be account addresses (G* or M*)  

All test fixtures are available in `src/services/x402/x402-v2-fixtures.ts` and demonstrate the validation boundaries.
