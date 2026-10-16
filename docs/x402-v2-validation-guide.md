# x402 v2 Validation Guide for Developers

Quick reference for implementing and testing x402 v2 payment challenges.

## Format Quick Reference

### Stellar Addresses (56 characters, base32)

| Type | Prefix | Example | Use Case |
|------|--------|---------|----------|
| Classic Account | `G` | `GBZXN7...DQSQE` | Payment recipient |
| Muxed Account | `M` | `MBZXN7...DQSQE` | Payment recipient (with memo) |
| Soroban Contract | `C` | `CB256K...YOJFS` | Asset in payment requirement |

**Valid base32 alphabet**: `A-Z` and `2-7` (no `0`, `1`, `8`, `9`)

### Amount Format

| Requirement | Example | Invalid |
|-------------|---------|---------|
| Positive integer | `"500000"` | `"0.5"` (decimal) |
| No leading zeros | `"123"` | `"0123"` (leading zero) |
| At least 1 unit | `"1"` | `"0"` (zero) |

Amount is in **atomic units**. Backend determines decimal conversion based on asset precision.

### Network Identifiers

| Network | Valid | Invalid |
|---------|-------|---------|
| Testnet | `"stellar:testnet"` | `"stellar:test"`, `"testnet"` |
| Mainnet | `"stellar:pubnet"` | `"stellar:mainnet"`, `"stellar:public"` |

Only testnet and pubnet are supported.

### Timeout (seconds)

| Constraint | Valid | Invalid |
|------------|-------|---------|
| Positive integer | `300`, `1`, `604800` | `0`, `-1`, `300.5` |
| Max 1 week | `604800` | `1000000` |

Timeout is the challenge validity window in seconds.

## Validation Checklist

When implementing x402 v2 challenge parsing:

- [ ] Decode `PAYMENT-REQUIRED` header using `@x402/core/http`
- [ ] Validate schema using `paymentRequiredV2Schema`
- [ ] Filter `accepts` array to `scheme: "exact"` only
- [ ] Select requirement matching wallet's network
- [ ] Validate all critical fields:
  - [ ] `network`: `"stellar:testnet"` or `"stellar:pubnet"`
  - [ ] `asset`: 56-char base32 starting with `C`
  - [ ] `amount`: Positive integer, no decimals/leading zeros
  - [ ] `payTo`: 56-char base32 starting with `G` or `M`
  - [ ] `maxTimeoutSeconds`: Positive integer ≤ 604,800
  - [ ] `scheme`: Literal `"exact"` only
- [ ] Calculate expiry: `receivedAt + maxTimeoutSeconds * 1000`
- [ ] Reject if expired
- [ ] Compute fingerprint to detect mutations
- [ ] Preserve extensions without validation
- [ ] Display error field if present

## Testing Checklist

When writing tests for x402 v2 challenges:

### Valid Fixtures
- [ ] Standard requirement with all fields
- [ ] Multiple networks in accepts array
- [ ] Multiple schemes (exact + upto)
- [ ] Optional metadata (description, icon, tags)
- [ ] Optional error field
- [ ] Optional extensions
- [ ] Edge cases: 1-second timeout, large amounts
- [ ] Extra fields preserved without validation

### Invalid Fixtures
- [ ] Amount: decimal, zero, leading zeros, negative
- [ ] Network: unsupported, malformed, wrong case
- [ ] Asset: empty, wrong prefix, invalid base32
- [ ] PayTo: empty, contract prefix, malformed
- [ ] Timeout: zero, negative, float, exceeds max
- [ ] Version: v1, v3, string, missing
- [ ] Scheme: upto only, missing, wrong value
- [ ] URL: relative, malformed, non-HTTP
- [ ] Empty accepts array
- [ ] No exact scheme offered

### Protocol Compliance
- [ ] Error messages cite specific constraint
- [ ] Fail-closed on ambiguous input
- [ ] No type coercion
- [ ] No default values
- [ ] Mutations detected via fingerprint
- [ ] Expiry enforced at request/auth/settlement
- [ ] URL canonicalization works

## Common Pitfalls

### ❌ Accepting decimals in amount
```typescript
// WRONG
{ "amount": "0.5" }  // Interpreted as decimal USDC

// RIGHT
{ "amount": "500000" }  // Atomic units with 7 decimals = 0.5 USDC
```

### ❌ Accepting contract address as recipient
```typescript
// WRONG
{ "payTo": "CB256KDRXDO2FYJN3YBYZE5KCU46WIIE67DRP5T7HI45DRH2GM6YOJFS" }

// RIGHT
{ "payTo": "GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE" }
```

### ❌ Accepting account address as asset
```typescript
// WRONG
{ "asset": "GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE" }

// RIGHT
{ "asset": "CB256KDRXDO2FYJN3YBYZE5KCU46WIIE67DRP5T7HI45DRH2GM6YOJFS" }
```

### ❌ Filtering to "upto" scheme instead of "exact"
```typescript
// WRONG
const requirement = challenge.accepts.find(r => r.scheme === "upto");

// RIGHT
const requirement = challenge.accepts.find(r => r.scheme === "exact");
```

### ❌ Not checking URL match
```typescript
// WRONG
const challenge = await fetch(...);  // Returns 402 for different URL

// RIGHT
if (canonicalUrl(challenge.resource.url) !== canonicalUrl(expectedUrl)) {
  throw new ChallengeError("CHALLENGE_MISMATCH", "URL changed");
}
```

### ❌ Not enforcing timeout
```typescript
// WRONG
// Wallet prompt happens 5 seconds later
const challenge = await requestChallenge();  // 300s timeout
await promptWallet();  // 5 second delay

// RIGHT
assertChallengeFresh(challenge);  // Check expiry at each step
```

## Fixture Usage

Use `src/services/x402/x402-v2-fixtures.ts` for testing:

```typescript
import { validExactRequirement, invalidAmountWithDecimals } from "@/services/x402/x402-v2-fixtures";

test("accepts valid requirement", () => {
  const result = exactPaymentRequirementsSchema.safeParse(validExactRequirement);
  expect(result.success).toBe(true);
});

test("rejects amount with decimals", () => {
  const result = exactPaymentRequirementsSchema.safeParse(invalidAmountWithDecimals);
  expect(result.success).toBe(false);
});
```

All fixtures include:
- Documentation of what makes them valid or invalid
- Expected behavior
- Error codes
- Usage examples

## Validator Functions

Use `src/services/x402/validation.ts` for fine-grained validation:

```typescript
import {
  isValidStellarAccountAddress,
  isValidSorobanContractId,
  isValidAtomicAmount,
  isValidNetworkId,
  isValidTimeoutSeconds,
  isValidAssetCode,
  isValidAbsoluteUrl
} from "@/services/x402/validation";

// All return boolean (true/false, never throw)
isValidAtomicAmount("500000");           // true
isValidAtomicAmount("0.5");              // false

isValidSorobanContractId("CB256K...");   // true
isValidSorobanContractId("GB...");       // false

isValidStellarAccountAddress("GB...");   // true
isValidStellarAccountAddress("CB...");   // false

isValidNetworkId("stellar:testnet");     // true
isValidNetworkId("ethereum:mainnet");    // false

isValidTimeoutSeconds(300);              // true
isValidTimeoutSeconds(300.5);            // false

isValidAssetCode("USDC");                // true
isValidAssetCode("TOOLONGCODE");         // false

isValidAbsoluteUrl("https://api.example.com/resource");  // true
isValidAbsoluteUrl("/relative");                         // false
```

## Integration Example

```typescript
import { requestPaymentChallenge, expectedTermsForResource } from "@/services/x402/challenge";
import { paymentRequiredV2Schema } from "@/services/api/schemas";

// 1. Get expected terms from resource
const terms = expectedTermsForResource(resource, supported, selectedNetwork);

// 2. Request and validate challenge
const validated = await requestPaymentChallenge(
  { method: "GET", url: resourceUrl, headers: [...] },
  terms,
  { fetchImpl: fetch }
);

// 3. Use validated challenge
console.log(validated.requirement.amount);  // Validated atomic amount
console.log(validated.expiresAt);          // Calculated expiry timestamp
console.log(validated.fingerprint);        // For mutation detection

// 4. Before authorization, check freshness
assertChallengeFresh(validated);

// 5. Before settlement, check freshness again
if (isChallengeExpired(validated)) {
  // Re-request challenge
  const fresh = await requestPaymentChallenge(...);
}
```

## References

- **Specification**: `docs/x402-v2-protocol.md`
- **Implementation**: `src/services/x402/`
- **Tests**: `src/services/x402/*.test.ts`, `tests/e2e/x402-v2-*.spec.ts`
- **Fixtures**: `src/services/x402/x402-v2-fixtures.ts`
- **API Contract**: `docs/api-contract.md`
