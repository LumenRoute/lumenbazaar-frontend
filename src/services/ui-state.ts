import { ApiClientError } from "@/services/api/client";

export type UiErrorState = {
  code: string;
  description: string;
  requestId?: string;
  title: string;
};

export type EmptyCollection = "conformance" | "payments" | "resources";

export function normalizeUiError(
  error: unknown,
  fallback: {
    code?: string;
    description: string;
    title: string;
  }
): UiErrorState {
  if (error instanceof ApiClientError) {
    return {
      code: error.code,
      description: error.message,
      requestId: error.requestId,
      title: fallback.title
    };
  }

  if (error instanceof Error) {
    return {
      code: fallback.code ?? "REQUEST_FAILED",
      description: error.message,
      title: fallback.title
    };
  }

  return {
    code: fallback.code ?? "REQUEST_FAILED",
    description: fallback.description,
    title: fallback.title
  };
}

export function emptyStateForCollection(collection: EmptyCollection) {
  switch (collection) {
    case "conformance":
      return {
        description: "Run the backend conformance suite to publish reviewer-facing evidence.",
        title: "No conformance run available"
      };
    case "payments":
      return {
        description: "Verification and settlement activity will appear after paid requests run.",
        title: "No payment attempts loaded"
      };
    case "resources":
      return {
        description:
          "Publish a resource or broaden the filters to include draft and inactive items.",
        title: "No resources loaded"
      };
  }
}

export function redactSensitivePaymentData(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitivePaymentData(item));
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      isSensitivePaymentKey(key) ? "[redacted]" : redactSensitivePaymentData(entry)
    ])
  );
}

export function isSensitivePaymentKey(key: string) {
  const normalized = key.toLowerCase();

  return [
    "authorization",
    "paymentpayload",
    "privatekey",
    "secret",
    "signature",
    "signedxdr",
    "walletaddress",
    "xdr"
  ].some((sensitiveKey) => normalized.includes(sensitiveKey));
}
