import type {
  JsonObject,
  JsonValue,
  PaymentPayload,
  PaymentVerification,
  PaymentRequiredV2,
  Resource,
  Settlement
} from "@/services/api/schemas";

export type PlaygroundAuthorizationMode = "simulation" | "wallet";

export type PaymentRequiredPreview = {
  body: PaymentRequiredV2;
  headers: Record<string, string>;
  statusCode: 402;
};

export function buildSampleRequest(schema: JsonObject): JsonObject {
  if (schema.type !== "object") {
    return {};
  }

  const properties = readProperties(schema);

  return Object.fromEntries(
    Object.entries(properties).map(([key, value]) => [key, sampleValue(value)])
  );
}

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

export function simulateVerification(request: PaymentPayload): PaymentVerification {
  return {
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

export function simulateSettlement(
  request: PaymentPayload,
  verification: PaymentVerification
): Settlement {
  const verificationEvidence = verification.extra?.lumenbazaar;
  const paymentAttemptId = verificationEvidence?.paymentAttemptId ?? "attempt_unknown";
  const transactionHash = "d8f22ec3e5f24f1ba6ef0d42370c8c3fb7fd7d845f9df04379524665b86a16e4";

  return {
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
