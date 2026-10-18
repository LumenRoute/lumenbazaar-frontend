# SEP-41 Asset Metadata and Decimal Formatting

This document describes the SEP-41 asset metadata system and the safe decimal formatting utilities added in issue #33.

## Overview

SEP-41 assets on Stellar are wrapped in Soroban smart contracts. Each asset is uniquely identified by:
- **Contract ID**: Soroban contract address (C* format, 56 characters)
- **Symbol**: Asset symbol (1-12 alphanumeric characters, e.g., "USDC")
- **Decimals**: Number of decimal places (0–7, per Stellar standard)
- **Issuer** (optional): Original Stellar asset issuer for cross-reference

Amounts on Stellar are always stored as integers (atomic units). Formatting requires:
1. Loading asset metadata from network configuration
2. Safe division using BigInt (no floating-point arithmetic)
3. Removing trailing zeros for clean display

## Asset Configuration

Assets are configured per network in `src/config/networks.ts`:

```typescript
export const stellarNetworks: Record<NetworkId, NetworkConfig> = {
  "stellar:testnet": {
    // ... network config ...
    assets: [
      {
        contractId: "CBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE",
        symbol: "USDC",
        decimals: 6,
        issuer: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
      },
      {
        contractId: "CBQYB6MKFOPG7BWBT5H3KK43L2CQFWW5J2VJPWMVSWWFDMLZTFGZW7FY",
        symbol: "BRL",
        decimals: 7
      }
    ]
  }
};
```

**Key points:**
- Assets are identified by **contract ID**, never by symbol alone
- Multiple assets can have the same symbol but different contracts (e.g., different USDC versions)
- Decimals are validated: 0–7 (no negative, no > 7)
- Issuer is optional; use contract ID for definitive identification

## Zod Schema

Asset metadata is validated using Zod:

```typescript
import { assetMetadataSchema } from "@/services/api/schemas";

const asset = assetMetadataSchema.parse({
  contractId: "CBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE",
  symbol: "USDC",
  decimals: 6
});
// ✓ Valid

assetMetadataSchema.parse({
  contractId: "CBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE",
  symbol: "USDC",
  decimals: 8 // ✗ Exceeds max (7)
});
// throws ZodError
```

## Formatting API

### `formatAtomicAmount(atomicAmount, asset)`

Formats an atomic amount into a human-readable decimal string.

```typescript
import { formatAtomicAmount } from "@/lib/amount-formatter";

const result = formatAtomicAmount("1234567", {
  contractId: "CBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE",
  symbol: "USDC",
  decimals: 6
});

console.log(result);
// {
//   formatted: "1.234567",      // Formatted amount
//   atomic: "1234567",           // Original atomic amount
//   symbol: "USDC",              // Asset symbol
//   contractId: "CBZXN...",      // Contract address
//   decimals: 6                  // Decimals used
// }
```

**Parameters:**
- `atomicAmount` (string): Positive integer without leading zeros (e.g., "1234567")
- `asset` (FormattableAsset): `{ contractId, symbol, decimals }`

**Returns:** `FormattedAmount` object with formatted string and metadata

**Throws:** Error if atomicAmount invalid or decimals out of bounds

**Examples:**

```typescript
// Standard USDC (6 decimals)
formatAtomicAmount("1000000", usdc).formatted  // "1"
formatAtomicAmount("500000", usdc).formatted   // "0.5"

// Very small amount
formatAtomicAmount("1", usdc).formatted        // "0.000001"

// Trailing zeros trimmed
formatAtomicAmount("1100000", usdc).formatted  // "1.1"

// Zero decimals (whole numbers)
formatAtomicAmount("100", whole).formatted     // "100"

// Max decimals (7)
formatAtomicAmount("12345678", tiny).formatted // "1.2345678"
```

### `tryFormatAmount(atomicAmount, contractId, network)`

Safe formatting that looks up asset metadata by contract ID.

```typescript
import { tryFormatAmount } from "@/lib/amount-formatter";

const result = tryFormatAmount(
  "1234567",
  "CBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE",
  "stellar:testnet"
);

if (result !== null) {
  console.log(result.formatted); // "1.234567"
} else {
  console.log("Asset metadata not found");
}
```

**Parameters:**
- `atomicAmount` (string): Atomic amount
- `contractId` (string): Soroban contract ID to look up
- `network` (NetworkId): "stellar:testnet" or "stellar:pubnet"

**Returns:** `FormattedAmount` if asset found, `null` if not

**Never throws:** Returns null for invalid input or missing metadata

**Use cases:**
- Display payment requirement amounts
- Show transaction amounts with fallback
- Format amounts from API responses

## Display Component

### `FormattedAmountDisplay`

React component for displaying formatted amounts with fallback.

```typescript
import { FormattedAmountDisplay } from "@/components/ui/formatted-amount";
import { tryFormatAmount } from "@/lib/amount-formatter";

function MyComponent({ amount, contractId, network }) {
  const formattedAmount = tryFormatAmount(amount, contractId, network);

  return (
    <FormattedAmountDisplay
      formattedAmount={formattedAmount}
      fallbackContractId={contractId}
      showAtomic={true}
    />
  );
}
```

**Props:**
- `formattedAmount` (FormattedAmount | null): Result from formatter or null
- `fallbackContractId` (string, optional): Shows when metadata unknown
- `showAtomic` (boolean, default: true): Toggle atomic value display
- `className` (string, optional): Custom CSS classes

**Display modes:**

**With metadata:**
```
1.234567 USDC
atomic: 1234567
contract: CBZXN7PI...DQSQE
```

**Without metadata (fallback):**
```
Unknown asset
contract: CBZXN7PI...DQSQE
```

## BigInt Arithmetic

The formatter uses **BigInt exclusively**, never floating-point:

```typescript
// Big Integers can safely represent amounts up to i128
// without precision loss

const amount = BigInt("170141183460469231731687303715884105727"); // i128 max
const divisor = BigInt(10 ** 6);

const integer = amount / divisor;   // ✓ Safe: whole division
const fraction = amount % divisor;  // ✓ Safe: remainder

// NOT: const result = amount / divisor; (floating-point, ✗ loses precision)
```

**Why BigInt?**
- IEEE 754 floats lose precision for numbers > 2^53
- Stellar amounts can exceed this (i128 boundary)
- BigInt preserves exact values; no rounding errors

## Integration Points

### Payment Requirement Viewer

`src/components/resources/payment-requirement-viewer.tsx`

```typescript
const formattedAmount = tryFormatAmount(
  requirement.amount,
  requirement.assetCode,      // Contract ID
  requirement.network
);

<FormattedAmountDisplay
  formattedAmount={formattedAmount}
  fallbackContractId={requirement.assetCode}
  showAtomic={true}
/>
```

### Transaction Dashboard

`src/components/transactions/transaction-dashboard.tsx`

```typescript
const formattedAmount = tryFormatAmount(
  activity.attempt.amount,
  activity.attempt.assetCode, // Contract ID
  activity.attempt.network
);

<FormattedAmountDisplay
  formattedAmount={formattedAmount}
  fallbackContractId={activity.attempt.assetCode}
  showAtomic={false}           // Cleaner for table rows
/>
```

## Security Considerations

### Symbol Spoofing Prevention

Two different assets with the same symbol (e.g., two different USDC versions on different networks) are distinguishable by contract ID:

```typescript
const usdc_v1 = tryFormatAmount(amount, "CA7QYNF7...", "stellar:pubnet");
const usdc_v2 = tryFormatAmount(amount, "CB7QYNF7...", "stellar:testnet");

// Both show "1.234567 USDC" but:
usdc_v1.contractId !== usdc_v2.contractId // ✓ Contract shown for verification
```

### Invalid Metadata Handling

- **Unknown contract:** Returns null; UI shows "Unknown asset"
- **Malformed decimals:** Caught by schema; asset rejected
- **Invalid amount:** Returns null; no formatting attempted
- **Missing asset:** Safe fallback; no crash

### Fallback Display

Unknown assets still show:
- Contract address (for verification)
- Atomic amount (for exact value)
- "Unknown asset" label (clear signal)

This allows UI to gracefully degrade when asset metadata is unavailable.

## Testing

### Unit Tests

```bash
# Run formatter tests
pnpm test -- src/lib/amount-formatter.test.ts --run

# Run config tests
pnpm test -- src/config/networks.test.ts --run

# Run component tests
pnpm test -- src/components/ui/formatted-amount.test.tsx --run
```

### E2E Tests

```bash
# Run responsive design tests
pnpm test:e2e:smoke
```

**Covered scenarios:**
- ✓ Standard amounts with various decimals
- ✓ Edge cases: zero decimals, max decimals, very small/large
- ✓ Invalid input: negative, zero, decimals, leading zeros
- ✓ Symbol spoofing: two assets with same symbol
- ✓ BigInt safety: i128 boundary values
- ✓ Fallback: unknown assets, malformed metadata
- ✓ Responsive design: desktop (1024px) and mobile (375px)
- ✓ Accessibility: atomic value always visible

## Examples

### Display a payment requirement

```typescript
function PaymentDetail({ requirement }) {
  const formatted = tryFormatAmount(
    requirement.amount,
    requirement.assetCode,
    requirement.network
  );

  return (
    <div>
      <FormattedAmountDisplay
        formattedAmount={formatted}
        fallbackContractId={requirement.assetCode}
        showAtomic={true}
      />
      <p>To: {requirement.payTo}</p>
    </div>
  );
}
```

### Handle unknown asset safely

```typescript
function TransactionRow({ transaction }) {
  const amount = tryFormatAmount(
    transaction.amount,
    transaction.contractId,
    transaction.network
  );

  // amount will be FormattedAmount | null
  // Component handles both cases gracefully
  return (
    <tr>
      <td><FormattedAmountDisplay formattedAmount={amount} /></td>
    </tr>
  );
}
```

### Format with custom asset

```typescript
import { formatAtomicAmount } from "@/lib/amount-formatter";

const customAsset = {
  contractId: "C...",
  symbol: "CUSTOM",
  decimals: 8
};

const result = formatAtomicAmount("100000000", customAsset);
console.log(result.formatted); // "1"
```

## Troubleshooting

### "Invalid atomic amount" error

**Cause:** Amount string doesn't match the pattern /^[1-9]\d*$/

**Solutions:**
- Remove leading zeros: "01234" → "1234"
- Use positive integers: "-100" → "100"
- Ensure no decimals: "123.45" → "12345" (with adjusted decimals)
- Use valid numbers: "abc" → use only digits

### "Invalid decimals" error

**Cause:** Decimals not in range 0–7

**Solutions:**
- Use SEP-41 standard (0–7)
- Check asset metadata from network config
- Validate before formatting

### Null from `tryFormatAmount`

**Cause:** Asset not found in network configuration

**Solutions:**
- Verify contract ID matches exactly (case-sensitive)
- Check correct network passed ("stellar:testnet" vs "stellar:pubnet")
- Add asset to network config if missing
- Use FormattedAmountDisplay fallback mode

### Formatting inconsistency across components

**Cause:** Using different formatters or missing memoization

**Solutions:**
- Always use `tryFormatAmount` for lookups
- Memoize formatted result in React components
- Use `FormattedAmountDisplay` for consistent rendering
- Don't duplicate formatting logic

## References

- [SEP-41: Soroban Stellar Asset Contract](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0046-01.md)
- [Stellar Asset Code Format](https://developers.stellar.org/docs/issuing-assets)
- [Soroban Contract Addresses](https://developers.stellar.org/docs/soroban/learn/storing-data#addresses)
- [BigInt JavaScript MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt)
