# Asset Trust Verification (Issue #34)

## Overview

This document describes the asset trust verification feature that warns users when payment assets are outside the trusted registry and requires explicit confirmation before proceeding.

## Problem Statement

Users need a clear distinction between:
- **Trusted assets**: Soroban contract IDs configured in the network registry
- **Unknown assets**: Valid contract IDs not in the registry
- **Lookalike assets**: Same symbol but different contract ID (e.g., fake USDC)

Without explicit verification, users could accidentally send payment to a malicious contract that mimics a trusted asset (e.g., a contract with symbol "USDC" but different contract ID).

## Solution

### 1. Asset Trust Classification

All payment assets are classified into one of four categories:

| Status | Reason | User Action |
|--------|--------|-------------|
| **Trusted** | Contract ID matches a registry entry | Proceed normally |
| **Unknown** | Valid contract ID, not in registry | Requires explicit checkbox + confirmation |
| **Malformed** | Invalid contract ID format | Cannot proceed (must fix) |
| **Network-Mismatched** | Contract from different network | Error state (future use) |

### 2. Registry Configuration

Trusted assets are configured per network in `src/config/networks.ts`:

```typescript
export const stellarNetworks: Record<NetworkId, NetworkConfig> = {
  "stellar:testnet": {
    assets: [
      {
        contractId: "CBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE",
        symbol: "USDC",
        decimals: 6,
        issuer: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
      },
      // ... more assets
    ],
    // ... other network config
  }
};
```

**Note**: Trust is determined by **contract ID only**. Symbol, name, and issuer are never used to establish trust.

### 3. Classification Logic

The `classifyAssetTrust()` function in `src/services/api/asset-trust.ts` performs the classification:

```typescript
import { classifyAssetTrust } from "@/services/api/asset-trust";

const status = classifyAssetTrust(
  "CBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE",
  "stellar:testnet"
);

// status: { type: "trusted", registryEntry: {...} }
```

### 4. UI Warning & Confirmation

When a payment asset is unknown, users see:

1. **Amber warning card** with alert icon and explanation
2. **Contract address comparison** showing:
   - Full 56-character requirement contract ID
   - Registry entry (if exists) with symbol, decimals, issuer
   - Match/mismatch indicator (red warning if different)
3. **Non-pre-checked confirmation checkbox** with descriptive text
4. **Disabled "Proceed" button** that enables only after checkbox is checked

#### Keyboard Accessibility

- Warning heading receives focus automatically (using `useRef` and `tabIndex={-1}`)
- Checkbox is keyboard-accessible (Tab, Space to toggle)
- Proceed button is keyboard-accessible (Tab, Enter)
- Focus trap keeps user within warning until action taken

#### Screen Reader Accessibility

- Heading identifies the warning type ("Unknown Asset" or "Invalid Asset Contract")
- Checkbox has associated label and description
- Button announces enabled/disabled state
- All iconography uses `aria-hidden="true"` with accompanying text

### 5. Contract Address Comparison

The `ContractAddressComparison` component displays:

- **Requirement Contract**: Full address from the payment requirement
  - Monospace font for clarity
  - Copy-to-clipboard button with visual feedback
  - Break-all wrapping for mobile devices

- **Registry Entry** (if available):
  - Symbol and decimals
  - Full contract ID
  - Optional issuer (abbreviated)

- **Match Indicator**:
  - ✓ Green: Addresses match (lookalike not detected)
  - ⚠ Red: Addresses differ (potential lookalike)

### 6. Common Scenarios

#### Scenario 1: Trusted Asset (USDC on Testnet)

```
Contract ID: CBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE
Classification: Trusted
UI: Green "Trusted Asset" badge + normal viewer
Action: Proceed normally
```

#### Scenario 2: Unknown Asset (Random Contract)

```
Contract ID: CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC
Classification: Unknown
UI: Amber warning + checkbox confirmation + disabled button
Action: User checks checkbox → button enables → user clicks Proceed
```

#### Scenario 3: Lookalike USDC (Same Symbol, Different Contract)

```
Requirement Contract: CBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQ1
Registry Entry (USDC): CBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE
Classification: Unknown (different contract)
UI: Warning + comparison showing "do not match" + checkbox confirmation
Action: User sees red warning about mismatched addresses → must confirm to proceed
```

#### Scenario 4: Malformed Contract ID

```
Contract ID: INVALID_CONTRACT_ID
Classification: Malformed
UI: Error message "Invalid Asset Contract" (no checkbox)
Action: User must fix resource and try again
```

## Implementation Details

### Files Created

1. **`src/services/api/asset-trust.ts`**
   - `classifyAssetTrust(contractId, network): AssetTrustStatus`
   - `assetTrustLabel(status): string`

2. **`src/components/resources/contract-address-comparison.tsx`**
   - Component for displaying and comparing contract addresses
   - Copy-to-clipboard with feedback
   - Lookalike detection

3. **`src/components/resources/payment-requirement-viewer.tsx`** (updated)
   - Integrated asset trust classification
   - Unknown asset warning UI
   - Confirmation checkbox
   - Focus management for accessibility

### Files Modified

1. **`src/config/networks.ts`**
   - No schema changes (existing `AssetMetadata` reused)
   - Registry entries are already present (USDC, BRL on testnet)

2. **`src/services/resource-detail.ts`** (if needed)
   - May pass asset trust classification context to viewer

## Security Considerations

### Spoofed Symbols

A malicious operator could create a contract with symbol "USDC" but different contract ID.

**Mitigation**: Trust is determined by contract ID only. The UI displays both contract IDs side-by-side, making the difference visible. The warning card alerts users to the mismatch.

### Case/Encoding Variants

Soroban contract IDs use base32 encoding (uppercase canonical form).

**Mitigation**: Contract ID validation uses `isValidSorobanContractId()` which enforces uppercase base32. Lowercase or modified IDs fail validation and are classified as "malformed".

### Registry Tampering

The registry is committed to the repository; any changes are auditable via git.

**Future**: Signed registry manifests could further protect against tampering.

### URL/Social Engineering

A phishing email could direct users to a fake "payment" with an unknown asset.

**Mitigation**: UI warning is clear and requires explicit checkbox. No amount of visual similarity or social engineering bypasses the confirmation.

## Testing

### Unit Tests

- `src/services/api/asset-trust.test.ts`: Classification logic
- `src/components/resources/contract-address-comparison.test.tsx`: Component behavior
- `src/components/resources/payment-requirement-viewer.test.tsx`: Warning UI and confirmation flow

**Test Coverage**:
- ✓ Trusted asset classification
- ✓ Unknown asset classification
- ✓ Malformed asset classification
- ✓ Lookalike symbol detection
- ✓ Network separation (testnet vs pubnet)
- ✓ Checkbox not pre-checked
- ✓ Button disabled until confirmed
- ✓ Keyboard accessibility
- ✓ Screen reader announcements
- ✓ Copy-to-clipboard functionality

### E2E Tests

- Desktop viewport (1024x768): Warning display, checkbox, button flow
- Mobile viewport (375x667): No horizontal overflow, contract address readable
- Keyboard-only navigation: All interactive elements reachable

### Manual Verification

1. **Desktop**: Navigate to resource with unknown asset, verify warning and confirmation flow
2. **Mobile**: Same flow, verify no horizontal scroll
3. **Keyboard**: Tab through warning, checkbox, button; verify all are reachable and functional
4. **Screen reader**: Use browser screen reader, verify warning and checkbox are announced

## User Guidance

### For End Users

When you see an "Unknown Asset" warning:

1. **Read the warning carefully**: It tells you the contract is not in the trusted registry
2. **Review the contract address**: Compare the requirement contract with any trusted registry entry
3. **Check for lookalikes**: If addresses look similar but different, it's a potential attack
4. **Verify the source**: If unsure, contact the payment requester to confirm the contract ID
5. **Check the checkbox** only if you've verified the contract ID is correct
6. **Click Proceed** to continue

### For Operators

When configuring payment resources:

1. **Use registry contracts**: Always use contract IDs from the trusted registry when possible
2. **Document custom contracts**: If using an unknown contract, document why and which network
3. **Test lookalikes**: Verify your UI shows correct addresses, not just symbols
4. **Monitor warnings**: Track if users frequently see warnings; it may indicate a UX issue or security concern

## Future Enhancements

- **Signed registry**: Add cryptographic signatures to the registry manifest
- **User registry**: Allow users to add personal trusted assets
- **Network switching**: Warn if payment switches networks mid-transaction
- **Asset metadata caching**: Cache SEP-41 metadata for faster lookups
- **Lookalike scoring**: Machine learning to detect similar-looking contracts

## References

- **Issue**: [GitHub #34 - Warn when payment assets are outside the trusted registry](https://github.com/LumenRoute/lumenbazaar-frontend/issues/34)
- **Related Issues**: #33 (SEP-41 asset metadata), #48 (Backend API pinning), #49 (Accessibility testing)
- **SEP-41**: [Soroban Stellar Asset Contract](https://stellar.org/protocol-upgrades)
- **Soroban**: [Contract IDs documentation](https://developers.stellar.org/docs/reference/soroban-contract-ids)
- **WCAG 2.1**: [Accessibility guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

## Changelog

### Version 1.0 (October 2026)

- Initial implementation
- Classification logic for 4 asset statuses
- Unknown asset warning with confirmation checkbox
- Contract address comparison component
- Accessibility support (keyboard, screen reader)
- Mobile responsive design
- Comprehensive test coverage
