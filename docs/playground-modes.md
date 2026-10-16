# Payment Playground: Live vs Simulation Modes

## Overview

The payment playground supports two explicit data modes for working with resources and settlement evidence:

- **Live Mode**: Loads resources from the live API and processes real settlements
- **Simulation Mode**: Uses fixture resources and generates synthetic settlement evidence

This document explains how modes work, when to use each, and how the playground prevents mixing live and simulated data.

## Mode Selection

When you open the playground, you'll see a **Data Mode** section at the top with two buttons:

- 🌐 **Live** - Attempts to load resources from the configured API (disabled if API is unavailable)
- ▶️ **Simulation** - Uses fixture resources for testing (always available)

### Switching Modes

Click either button to switch modes. When you switch:
1. Verification/settlement results are cleared
2. Resources are re-loaded for the new mode
3. Resource selection resets to the first available resource

### Live Mode

**When API is available:**
- Resources are loaded from the live API
- Data source badge shows: **Live API** (green)
- Verification/settlement results can be viewed in the Stellar block explorer
- Explorer links are enabled and safe to click

**When API is unavailable:**
- An error message is shown: "Live resources unavailable"
- Live button is disabled
- A "Switch to Simulation" button is offered
- You must explicitly choose simulation to proceed

_Important:_ The playground **does not auto-fallback** to simulation if the API fails. This prevents accidentally mixing live and simulated data.

### Simulation Mode

**Always available for testing:**
- Resources are loaded from fixture data (no API call)
- Data source badge shows: **Simulated (fixtures)** (amber)
- All verification/settlement results are synthetic
- Transaction hashes are predictable (not real on-chain hashes)
- Explorer links are **not shown** for simulated settlements
- Instead, you'll see: "Simulated result (explorer links unavailable)"

## Understanding Badges

Each verification and settlement result includes a badge indicating its data source:

### Live Results
```
✓ Verification  [complete] [Live]
Status: verified
Attempt: attempt_live_123
Hash: hash_live_…
Adapter: @x402/stellar

🔗 Stellar transaction ← Safe to click for live results
```

### Simulated Results
```
✓ Verification  [complete] [Simulated]
Status: verified
Attempt: attempt_playground_resource_123
Hash: playground_…
Adapter: @x402/stellar

Simulated result (explorer links unavailable) ← No link for simulated
```

## How Records are Distinguished

The playground uses TypeScript discriminated unions to prevent mixing live and simulated records:

```typescript
type PlaygroundVerification = {
  dataMode: "live" | "simulation";
  // ... other fields
};

type PlaygroundSettlement = {
  dataMode: "live" | "simulation";
  // ... other fields
};
```

Every verification and settlement record explicitly declares whether it's `"live"` or `"simulation"`. The type system prevents rendering live data without checking the mode, and explorer links only appear for live records.

## Synthetic Hashes in Simulation Mode

When you simulate a settlement, the playground generates a predictable hash for demonstration:

```
d8f22ec3e5f24f1ba6ef0d42370c8c3fb7fd7d845f9df04379524665b86a16e4
```

This hash is recognizable as synthetic (not a real Stellar transaction hash) and is **never rendered as clickable evidence** in live contexts. It's always labeled as "Simulated" to prevent confusion.

## Authorization Mode vs Data Mode

The playground has two separate mode concepts:

### Data Mode (What we just covered)
- Controls whether resources come from **live API** or **fixture data**
- Buttons: Live / Simulation
- Badge shows: "Live API" or "Simulated (fixtures)"
- Affects: Resource loading, settlement explorer links, data source

### Authorization Mode (Payment signature type)
- Controls the **transaction type** in the payment payload
- Buttons: Simulation / Wallet draft / 402
- Affects: Only the `transaction` field in the payment request
- Independent of data source: You can use a live resource with simulated authorization, or vice versa

## Typical Workflows

### Testing Without API (Fixture-Based)
1. Select **Simulation** mode (or verify it's selected)
2. Choose a resource from the dropdown
3. Click "Simulate verify" to test verification logic
4. Click "Simulate settle" to see settlement evidence
5. Synthetic data is clearly labeled as "Simulated"

### Testing Against Live API (When Available)
1. Select **Live** mode
2. If API is available, live resources load automatically
3. Verify results show "Live API" badge
4. Click explorer links to view real transactions on Stellar testnet
5. Verification/settlement are real and on-chain

### Mixed Testing
1. Load a live resource with **Live** mode
2. Use **Simulation** for authorization (wallet draft → simulated)
3. Verify result shows "Live" (resource source) while payload uses simulated tx
4. This combination helps test the x402 flow without requiring a real wallet

## API Unavailability

If the live API cannot be reached:

```
⚠️ Live resources unavailable
Could not reach the live API. Switch to Simulation mode to use fixtures instead.
[Switch to Simulation]
```

This error message is **always shown** if the API fails. You must explicitly click "Switch to Simulation" to proceed. There is **no silent fallback** to prevent accidentally mixing data sources.

## Error Handling

### Type Safety
The TypeScript type system ensures:
- Live and simulated records are not accidentally mixed
- Explorer links only render for `dataMode: "live"`
- Result panels must acknowledge the data mode

### Runtime Safety
- Resource lists are separate per mode
- Switching modes clears all transient state (verification, settlement)
- Mode badges are always visible on results
- No explorer links for synthetic hashes

## Preflight Checks

Preflight validation (checking if an account has the required trustline and balance) works with **both modes** because it queries the live Stellar network regardless of playground mode. This allows you to validate accounts even in simulation mode.

The preflight check uses the **currently selected resource's** asset details (code, issuer, amount), so results are specific to the resource you're working with.

## Best Practices

1. **Be explicit about your mode**: Always check the mode badge before interpreting results
2. **Don't rely on synthetic hashes**: Simulated transaction hashes are for demonstration only
3. **Use simulation for testing logic**: Fixtures are fast and don't depend on network availability
4. **Use live for integration testing**: Real resources and API connections reveal timing issues
5. **Check the data source badge**: On verification and settlement results, always verify the `[Live]` or `[Simulated]` badge

## Troubleshooting

**Q: Why can't I click the explorer link for my settlement?**
A: Your settlement is marked as `[Simulated]`. Only live settlements (`[Live]` badge) have clickable explorer links. Use Live mode to get real settlements.

**Q: I switched to Live mode but resources didn't load.**
A: The API may be unavailable. Check for an error message in the Data Mode section. The Live button will be disabled if the API cannot be reached.

**Q: Why did my verification disappear when I switched modes?**
A: State is intentionally cleared when switching modes to prevent mixing live and simulated data. Generate a new verification in the new mode.

**Q: Can I use a live resource with simulated authorization?**
A: Yes! Data mode (live/simulation) and authorization mode (simulation/wallet draft) are independent. This is useful for testing x402 flows without a real wallet.

## API Reference

### Service Layer Types

```typescript
// playground.ts

// Data source indicator
type PlaygroundDataMode = "live" | "simulation";

// Verification with explicit data source
type PlaygroundVerification = {
  dataMode: PlaygroundDataMode;
  isValid: boolean;
  extra?: {
    lumenbazaar: {
      adapter: string;
      correlationId: string;
      network: string;
      paymentAttemptId: string;
      paymentHash: string;
      status: string;
    };
  };
};

// Settlement with explicit data source (synthetic hashes labeled)
type PlaygroundSettlement = {
  dataMode: PlaygroundDataMode;
  success: boolean;
  amount: string;
  network: string;
  transaction: string; // Synthetic in simulation mode
  extra?: {
    lumenbazaar: {
      correlationId: string;
      ledger: number;
      paymentAttemptId: string;
      receiptId: string;
      status: string;
      transactionHash: string;
    };
  };
};

// Helpers
markVerificationAsLive(verification: PaymentVerification): PlaygroundVerification
markSettlementAsLive(settlement: Settlement): PlaygroundSettlement
simulateVerification(request: PaymentPayload): PlaygroundVerification
simulateSettlement(request: PaymentPayload, verification: PlaygroundVerification): PlaygroundSettlement
```

## See Also

- [API Contract Documentation](./api-contract.md)
- [Preflight Validation](./preflight-validation.md)
- [Payment Flow State Labels](./api-contract.md#payment-flow-states)
