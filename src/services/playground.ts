import type {
  JsonObject,
  JsonValue,
  PaymentPayload,
  PaymentVerification as ApiPaymentVerification,
  PaymentRequiredV2,
  Resource,
  Settlement as ApiSettlement
} from "@/services/api/schemas";

/**
 * Authorization mode for playground transactions.
 * Controls the transaction type in the payment payload (simulated vs wallet-draft).
 * Distinct from dataMode, which controls data source (live vs fixture).
 *
 * @remarks
 * This is independent of PlaygroundDataMode. You can test live resources with
 * simulated authorization, or vice versa, to debug specific parts of the x402 flow.
 *
 * @example
 * ```typescript
 * const req = buildPlaygroundPaymentRequest(liveResource, { authorizationMode: "wallet" });
 * // Uses real resource data but simulates wallet authorization
 * ```
 */
export type PlaygroundAuthorizationMode = "simulation" | "wallet";

/**
 * Data mode for playground resources and settlement evidence.
 * Controls whether data comes from live API or simulated fixtures.
 *
 * @remarks
 * This discriminates the origin of resources and settlement evidence, ensuring
 * that synthetic hashes are never rendered as live evidence and explorer links
 * are only shown for real, on-chain settlements.
 *
 * When "live": Resources and settlement evidence come from the live API.
 * When "simulation": Resources are fixtures and settlement evidence is synthetic.
 *
 * The playground never silently falls back from "live" to "simulation" if the API
 * fails; the user must explicitly choose simulation mode.
 */
export type PlaygroundDataMode = "live" | "simulation";

/**
 * Playground verification result with explicit data mode indicator.
 * Discriminated union that ensures live and simulated verification records cannot
 * be accidentally mixed or rendered in the wrong context.
 *
 * @remarks
 * The `dataMode` field must be checked before rendering verification results.
 * - For "live": Results come from the real API; adapter and correlationId are trustworthy.
 * - For "simulation": Results are synthetic; adapter is fixed to "@x402/stellar" for demonstration.
 *
 * This type structure ensures the TypeScript compiler prevents rendering live-only
 * UI elements (like explorer links) for simulated records.
 *
 * @example
 * ```typescript
 * const verification = simulateVerification(request);
 * if (verification.dataMode === "live") {
 *   // Safe to show explorer link
 * } else {
 *   // Show "Simulated result" message instead
 * }
 * ```
 */
export type PlaygroundVerification = Omit<ApiPaymentVerification, "extra"> & {
  /** Indicator of data source: live API or simulated fixture */
  dataMode: PlaygroundDataMode;
  extra?: {
    lumenbazaar: {
      /** @see @x402/stellar adapter identifier */
      adapter?: string;
      /** Correlation ID for tracing (simulator uses "corr_playground_simulation") */
      correlationId: string;
      /** Network ID (e.g., "stellar:testnet") */
      network: string;
      /** Payment attempt ID (simulator: "attempt_playground_*", live: "attempt_live_*") */
      paymentAttemptId: string;
      /** Payment hash (simulator: "playground_*", live: real hash) */
      paymentHash: string;
      /** Verification status (usually "verified") */
      status: string;
    };
  };
};

/**
 * Playground settlement result with explicit data mode indicator.
 * Discriminated union that ensures synthetic transaction hashes are never
 * rendered as clickable explorer evidence or shown with live-only UI elements.
 *
 * @remarks
 * The `dataMode` field must be checked before rendering settlement results.
 * - For "live": Transaction hash is real; safe to show explorer link.
 * - For "simulation": Transaction hash is synthetic (predictable hex string);
 *   must not be shown as evidence or in clickable explorer links.
 *
 * The synthetic hash for simulated settlements is always:
 * "d8f22ec3e5f24f1ba6ef0d42370c8c3fb7fd7d845f9df04379524665b86a16e4"
 *
 * This type structure prevents the type system from allowing explorer link
 * rendering without an explicit `dataMode === "live"` check.
 *
 * @example
 * ```typescript
 * const settlement = simulateSettlement(request, verification);
 * if (settlement.dataMode === "live" && settlement.transaction) {
 *   // Safe: show clickable explorer link
 *   <a href={explorerUrl(settlement.network, settlement.transaction)}>View</a>
 * } else {
 *   // Show: "Simulated result (explorer links unavailable)"
 * }
 * ```
 */
export type PlaygroundSettlement = Omit<ApiSettlement, "extra"> & {
  /** Indicator of data source: live API or simulated fixture */
  dataMode: PlaygroundDataMode;
  extra?: {
    lumenbazaar: {
      /** Correlation ID for tracing (simulator uses "corr_playground_simulation") */
      correlationId: string;
      /** Ledger sequence number (simulator uses 113,300) */
      ledger: number;
      /** Payment attempt ID (simulator: "attempt_playground_*", live: "attempt_live_*") */
      paymentAttemptId: string;
      /** Receipt ID for settlement lookup (simulator: "receipt_attempt_playground_*") */
      receiptId: string;
      /** Settlement ID (optional, may not always be present) */
      settlementId?: string;
      /** Settlement status (usually "confirmed") */
      status: string;
      /** Transaction hash (simulator: fixed synthetic hash, live: real hash) */
      transactionHash: string;
    };
  };
};

/**
 * 402 Payment Required preview response.
 * Shows the headers and body that would be sent in a 402 challenge flow.
 */
export type PaymentRequiredPreview = {
  body: PaymentRequiredV2;
  headers: Record<string, string>;
  statusCode: 402;
};

/**
 * Generate sample request data from a JSON schema.
 * Used to populate example input data for resources in the playground.
 *
 * @param schema - JSON schema object with properties to sample
 * @returns Object with sample values for each property
 *
 * @remarks
 * Prioritizes in order:
 * 1. `examples` array (first example)
 * 2. `default` value
 * 3. `enum` array (first enum value)
 * 4. Type-based defaults (string → "example", number → 1, etc.)
 *
 * @example
 * ```typescript
 * const schema = {
 *   properties: {
 *     city: { examples: ["Lagos"], type: "string" },
 *     days: { default: 3, type: "integer" }
 *   },
 *   type: "object"
 * };
 * buildSampleRequest(schema); // { city: "Lagos", days: 3 }
 * ```
 */
export function buildSampleRequest(schema: JsonObject): JsonObject {
  if (schema.type !== "object") {
    return {};
  }

  const properties = readProperties(schema);

  return Object.fromEntries(
    Object.entries(properties).map(([key, value]) => [key, sampleValue(value)])
  );
}

/**
 * Build a complete x402 payment request for the playground.
 * Creates both the outer request structure and inner payment requirements.
 *
 * @param resource - The resource being purchased
 * @param options - Configuration for the payment request
 * @param options.authorizationMode - Authorization type: "simulation" or "wallet"
 * @param options.currentLedger - Optional ledger number (unused, for future extension)
 * @param options.paymentHash - Optional payment hash (generated from resource ID if not provided)
 *
 * @returns Complete payment request ready to send to the verification API
 *
 * @remarks
 * This function generates the payment request structure but does NOT execute verification
 * or settlement. Use `simulateVerification()` or `apiClient.verifyPayment()` for that.
 *
 * The generated payment hash uses the resource ID and timestamp for uniqueness in simulation.
 * For live requests, use a real payment hash from the challenge flow.
 *
 * @example
 * ```typescript
 * const request = buildPlaygroundPaymentRequest(resource, {
 *   authorizationMode: "wallet",
 *   paymentHash: "custom-hash-123"
 * });
 * // Request is ready to pass to apiClient.verifyPayment()
 * ```
 */
export function buildPlaygroundPaymentRequest(
  resource: Resource,
  options: {
    authorizationMode?: PlaygroundAuthorizationMode;
    currentLedger?: number;
    paymentHash?: string;
  } = {}
): PaymentPayload {
  const paymentHash = options.paymentHash ?? createPaymentHash(resource.id);
  const paymentRequirements = paymentRequirementsForResource(resource, paymentHash);

  return {
    paymentPayload: {
      accepted: paymentRequirements,
      payload: {
        transaction: options.authorizationMode === "wallet" ? "wallet-draft" : "simulation"
      },
      resource: {
        description: resource.description,
        url: resource.url
      },
      x402Version: 2
    },
    paymentRequirements,
    x402Version: 2
  };
}

/**
 * Generate a 402 Payment Required response preview.
 * Shows what headers and body the backend would return when asking for payment.
 *
 * @param resource - The resource triggering the payment requirement
 * @returns Payment required preview with 402 status code and headers
 *
 * @remarks
 * This is used in the playground to show developers what a 402 response looks like
 * without actually making an HTTP request. The PAYMENT-REQUIRED header contains
 * the payment requirements in JSON format.
 *
 * In the actual x402 v2 flow, the backend would return this 402 when a client
 * tries to access a paid resource without valid payment proof.
 *
 * @example
 * ```typescript
 * const preview = buildPaymentRequiredPreview(resource);
 * console.log(preview.statusCode); // 402
 * console.log(preview.headers["PAYMENT-REQUIRED"]); // JSON string of requirements
 * ```
 */
export function buildPaymentRequiredPreview(resource: Resource): PaymentRequiredPreview {
  const body: PaymentRequiredV2 = {
    accepts: [paymentRequirementsForResource(resource, "challenge-preview")],
    resource: {
      description: resource.description,
      url: resource.url
    },
    x402Version: 2
  };

  return {
    body,
    headers: {
      "content-type": "application/json",
      "PAYMENT-REQUIRED": JSON.stringify(body)
    },
    statusCode: 402
  };
}

/**
 * Simulate payment verification with explicit simulation mode marker.
 * Returns a verification record labeled as simulated so it cannot be
 * confused with live API verification.
 *
 * @param request - The payment request to verify (simulation data)
 * @returns Simulated verification with `dataMode: "simulation"`
 *
 * @remarks
 * This function is safe to use even when the live API is unavailable. It always
 * returns a successful verification with predictable data suitable for testing.
 *
 * The returned verification includes:
 * - `dataMode: "simulation"` to indicate synthetic origin
 * - Playground-prefixed attempt IDs: "attempt_playground_*"
 * - Playground-prefixed payment hashes: "playground_*"
 * - Fixed adapter: "@x402/stellar"
 * - Fixed correlationId: "corr_playground_simulation"
 *
 * These markers help distinguish simulated from live results in the UI and prevent
 * accidental mixing of synthetic and real settlement evidence.
 *
 * @example
 * ```typescript
 * const request = buildPlaygroundPaymentRequest(fixture);
 * const verification = simulateVerification(request);
 * // verification.dataMode === "simulation"
 * // verification.extra.lumenbazaar.paymentAttemptId starts with "attempt_playground_"
 * ```
 */
export function simulateVerification(request: PaymentPayload): PlaygroundVerification {
  return {
    dataMode: "simulation",
    extra: {
      lumenbazaar: {
        adapter: "@x402/stellar",
        correlationId: "corr_playground_simulation",
        network: request.paymentRequirements.network,
        paymentAttemptId: `attempt_playground_${String(request.paymentRequirements.extra.resourceId ?? "resource")}`,
        paymentHash: String(
          request.paymentRequirements.extra.paymentHash ?? createPaymentHash("playground")
        ),
        status: "verified"
      }
    },
    isValid: true
  };
}

/**
 * Simulate payment settlement with explicit simulation mode marker.
 * The synthetic transaction hash is labeled as simulated so it cannot
 * be rendered as live settlement evidence or shown in explorer links.
 *
 * @param request - The payment request being settled
 * @param verification - The verification result (used to copy IDs and correlationId)
 * @returns Simulated settlement with `dataMode: "simulation"` and synthetic transaction hash
 *
 * @remarks
 * The returned settlement includes:
 * - `dataMode: "simulation"` to indicate synthetic origin
 * - Fixed synthetic hash: "d8f22ec3e5f24f1ba6ef0d42370c8c3fb7fd7d845f9df04379524665b86a16e4"
 * - Playground-prefixed receipt IDs: "receipt_attempt_playground_*"
 * - Fixed ledger: 113,300 (not a real ledger number)
 * - Status: "confirmed" (always successful in simulation)
 *
 * The synthetic hash is recognizable and intentionally non-clickable in the UI.
 * When the component renders a settlement, it checks `dataMode` before creating
 * explorer links, so simulated hashes never appear as clickable evidence.
 *
 * @example
 * ```typescript
 * const request = buildPlaygroundPaymentRequest(fixture);
 * const verification = simulateVerification(request);
 * const settlement = simulateSettlement(request, verification);
 * // settlement.dataMode === "simulation"
 * // settlement.transaction === "d8f22ec3e5f24f1ba6ef0d42370c8c3fb7fd7d845f9df04379524665b86a16e4"
 * // Explorer link will NOT render because dataMode is not "live"
 * ```
 */
export function simulateSettlement(
  request: PaymentPayload,
  verification: PlaygroundVerification
): PlaygroundSettlement {
  const verificationEvidence = verification.extra?.lumenbazaar;
  const paymentAttemptId = verificationEvidence?.paymentAttemptId ?? "attempt_unknown";
  const transactionHash = "d8f22ec3e5f24f1ba6ef0d42370c8c3fb7fd7d845f9df04379524665b86a16e4";

  return {
    dataMode: "simulation",
    amount: request.paymentRequirements.amount,
    extra: {
      lumenbazaar: {
        correlationId: verificationEvidence?.correlationId ?? "corr_playground_simulation",
        ledger: 113_300,
        paymentAttemptId,
        receiptId: `receipt_${paymentAttemptId}`,
        settlementId: `settlement_${paymentAttemptId}`,
        status: "confirmed",
        transactionHash
      }
    },
    network: request.paymentRequirements.network,
    success: true,
    transaction: transactionHash
  };
}

/**
 * Wrap live API verification response with explicit live data mode marker.
 * Ensures live verification records are distinguishable from simulated ones.
 *
 * @param verification - Raw verification from the live API
 * @returns Same verification with `dataMode: "live"` added
 *
 * @remarks
 * This function is called when verification comes from the real API (not simulated).
 * It adds the `dataMode: "live"` discriminator field so the UI can safely render
 * explorer links and other live-only features.
 *
 * The type system ensures that only records with `dataMode: "live"` can trigger
 * rendering of explorer links, preventing accidental exposure of synthetic hashes.
 *
 * @example
 * ```typescript
 * const apiVerification = await apiClient.verifyPayment(request);
 * const marked = markVerificationAsLive(apiVerification);
 * // marked.dataMode === "live"
 * // Safe to show explorer link now
 * ```
 */
export function markVerificationAsLive(verification: ApiPaymentVerification): PlaygroundVerification {
  return {
    ...verification,
    dataMode: "live"
  };
}

/**
 * Wrap live API settlement response with explicit live data mode marker.
 * Ensures live settlements (with real transaction hashes) can be safely
 * rendered with explorer links and never confused with synthetic evidence.
 *
 * @param settlement - Raw settlement from the live API
 * @returns Same settlement with `dataMode: "live"` added
 *
 * @remarks
 * This function is called when settlement comes from the real API (not simulated).
 * It adds the `dataMode: "live"` discriminator field so the UI knows this is
 * real, on-chain evidence that can be shown in the Stellar explorer.
 *
 * The type system ensures that explorer links only render when `dataMode: "live"`,
 * preventing accidental display of synthetic transaction hashes as real evidence.
 *
 * @example
 * ```typescript
 * const apiSettlement = await apiClient.settlePayment(request);
 * const marked = markSettlementAsLive(apiSettlement);
 * // marked.dataMode === "live"
 * // Explorer link can now be safely rendered
 * ```
 */
export function markSettlementAsLive(settlement: ApiSettlement): PlaygroundSettlement {
  return {
    ...settlement,
    dataMode: "live"
  };
}

function paymentRequirementsForResource(resource: Resource, paymentHash: string) {
  const configuredContract = resource.extensions.assetContractId;

  return {
    amount: toAtomicAmount(resource.amount, 7),
    asset: typeof configuredContract === "string" ? configuredContract : "CDEMOASSETCONTRACT",
    extra: {
      assetCode: resource.assetCode,
      assetIssuer: resource.assetIssuer,
      paymentHash,
      resourceId: resource.id
    },
    maxTimeoutSeconds: 300,
    network: resource.network,
    payTo: resource.payTo,
    scheme: "exact" as const
  };
}

function toAtomicAmount(amount: string, decimals: number) {
  const [whole = "0", fraction = ""] = amount.split(".");
  const atomic = `${whole}${fraction.padEnd(decimals, "0").slice(0, decimals)}`.replace(/^0+/, "");
  return atomic.length === 0 ? "1" : atomic;
}

function sampleValue(value: JsonValue): JsonValue {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const schema = value as JsonObject;
  const examples = schema.examples;

  if (Array.isArray(examples) && examples.length > 0) {
    return (examples[0] ?? null) as JsonValue;
  }

  if (typeof schema.default !== "undefined") {
    return schema.default;
  }

  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return (schema.enum[0] ?? null) as JsonValue;
  }

  if (schema.type === "string") {
    return "example";
  }

  if (schema.type === "number" || schema.type === "integer") {
    return 1;
  }

  if (schema.type === "boolean") {
    return true;
  }

  if (schema.type === "array") {
    return [];
  }

  if (schema.type === "object") {
    return buildSampleRequest(schema);
  }

  return null;
}

function readProperties(schema: JsonObject): Record<string, JsonValue> {
  const properties = schema.properties;

  if (typeof properties !== "object" || properties === null || Array.isArray(properties)) {
    return {};
  }

  return properties as Record<string, JsonValue>;
}

function createPaymentHash(resourceId: string) {
  return `playground_${resourceId}_${Date.now().toString(36)}`;
}
