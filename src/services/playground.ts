import type {
  JsonObject,
  JsonValue,
  PaymentPayload,
  PaymentVerification,
  Resource,
  Settlement
} from "@/services/api/schemas";

export type PlaygroundAuthorizationMode = "simulation" | "wallet";

export type PaymentRequiredPreview = {
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
  const authorization =
    options.authorizationMode === "wallet"
      ? {
          method: "freighter",
          status: "pending-wallet-signature"
        }
      : {
          method: "simulation",
          status: "accepted"
        };

  return {
    currentLedger: options.currentLedger ?? 1,
    paymentPayload: {
      amount: resource.amount,
      asset: {
        code: resource.assetCode,
        issuer: resource.assetIssuer
      },
      authorization,
      expiresAtLedger: 1_000_000_000,
      network: resource.network,
      payTo: resource.payTo,
      paymentHash,
      scheme: "exact"
    },
    paymentRequirements: {
      amount: resource.amount,
      asset: {
        code: resource.assetCode,
        issuer: resource.assetIssuer
      },
      network: resource.network,
      payTo: resource.payTo,
      scheme: "exact"
    },
    resourceId: resource.id,
    sellerId: resource.sellerId
  };
}

export function buildPaymentRequiredPreview(resource: Resource): PaymentRequiredPreview {
  const requirement = {
    amount: resource.amount,
    asset: {
      code: resource.assetCode,
      issuer: resource.assetIssuer
    },
    network: resource.network,
    payTo: resource.payTo,
    resourceId: resource.id,
    scheme: "exact",
    x402Version: "1"
  };

  return {
    headers: {
      "content-type": "application/json",
      "x-payment-required": JSON.stringify(requirement)
    },
    statusCode: 402
  };
}

export function simulateVerification(request: PaymentPayload): PaymentVerification {
  return {
    adapter: "@x402/stellar",
    network: request.paymentPayload.network,
    paymentAttemptId: `attempt_playground_${request.resourceId ?? "resource"}`,
    paymentHash: request.paymentPayload.paymentHash ?? createPaymentHash("playground"),
    status: "verified"
  };
}

export function simulateSettlement(
  request: PaymentPayload,
  verification: PaymentVerification
): Settlement {
  return {
    ledger: 113_300,
    network: request.paymentPayload.network,
    paymentAttemptId: verification.paymentAttemptId,
    receiptId: `receipt_${verification.paymentAttemptId}`,
    settlementId: `settlement_${verification.paymentAttemptId}`,
    status: "settled",
    transactionHash: "d8f22ec3e5f24f1ba6ef0d42370c8c3fb7fd7d845f9df04379524665b86a16e4"
  };
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
