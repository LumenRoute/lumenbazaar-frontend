import { type z } from "zod";

import { loadRuntimeConfig } from "@/config/runtime";

import {
  apiFailureSchema,
  conformanceRunSchema,
  createSellerInputSchema,
  healthSchema,
  listResourcesQuerySchema,
  networksSchema,
  paymentPayloadSchema,
  paymentVerificationSchema,
  receiptSchema,
  resourceSchema,
  resourcesPageSchema,
  searchResourcesQuerySchema,
  searchResultSchema,
  sellerSchema,
  settlementSchema,
  supportedSchema,
  verifyDomainResultSchema,
  versionSchema,
  type ApiFailure,
  type ConformanceRun,
  type CreateSellerInput,
  type ListResourcesQuery,
  type PaymentPayload,
  type PaymentVerification,
  type Receipt,
  type Resource,
  type ResourcesPage,
  type SearchResourcesQuery,
  type SearchResult,
  type Seller,
  type Settlement,
  type VerifyDomainResult
} from "./schemas";

type ApiClientOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

type RequestOptions<TSchema extends z.ZodType> = {
  body?: unknown;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: Record<string, string | number | boolean | null | undefined>;
  schema: TSchema;
};

export class ApiClientError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown> | undefined;
  readonly requestId: string | undefined;
  readonly status: number;

  constructor({
    code,
    details,
    message,
    requestId,
    status
  }: {
    code: string;
    details?: Record<string, unknown>;
    message: string;
    requestId?: string;
    status: number;
  }) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.details = details;
    this.requestId = requestId;
    this.status = status;
  }
}

export class LumenBazaarApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ApiClientOptions = {}) {
    const config = loadRuntimeConfig();

    this.baseUrl = options.baseUrl ?? config.apiBaseUrl;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  getHealth() {
    return this.request("/health", { schema: healthSchema });
  }

  getVersion() {
    return this.request("/version", { schema: versionSchema });
  }

  getNetworks() {
    return this.request("/v1/networks", { schema: networksSchema });
  }

  getSupported() {
    return this.request("/v1/supported", { schema: supportedSchema });
  }

  listResources(query: ListResourcesQuery = {}): Promise<ResourcesPage> {
    return this.request("/v1/resources", {
      query: listResourcesQuerySchema.parse(query),
      schema: resourcesPageSchema
    });
  }

  searchResources(query: SearchResourcesQuery = {}): Promise<SearchResult> {
    return this.request("/v1/discovery/search", {
      query: searchResourcesQuerySchema.parse(query),
      schema: searchResultSchema
    });
  }

  getResource(resourceId: string): Promise<Resource> {
    return this.request(`/v1/resources/${encodeURIComponent(resourceId)}`, {
      schema: resourceSchema
    });
  }

  createSeller(input: CreateSellerInput): Promise<Seller> {
    return this.request("/v1/sellers", {
      body: createSellerInputSchema.parse(input),
      method: "POST",
      schema: sellerSchema
    });
  }

  requestDomainChallenge(
    sellerId: string,
    method: VerifyDomainResult["method"] = "well-known"
  ): Promise<VerifyDomainResult> {
    return this.request(`/v1/sellers/${encodeURIComponent(sellerId)}/verify-domain`, {
      body: { method },
      method: "POST",
      schema: verifyDomainResultSchema
    });
  }

  submitDomainVerification(
    sellerId: string,
    evidence: string,
    method: VerifyDomainResult["method"] = "well-known"
  ): Promise<VerifyDomainResult> {
    return this.request(`/v1/sellers/${encodeURIComponent(sellerId)}/verify-domain`, {
      body: { evidence, method },
      method: "POST",
      schema: verifyDomainResultSchema
    });
  }

  verifyPayment(payload: PaymentPayload): Promise<PaymentVerification> {
    return this.request("/v1/verify", {
      body: paymentPayloadSchema.parse(payload),
      method: "POST",
      schema: paymentVerificationSchema
    });
  }

  settlePayment(payload: PaymentPayload): Promise<Settlement> {
    return this.request("/v1/settle", {
      body: paymentPayloadSchema.parse(payload),
      method: "POST",
      schema: settlementSchema
    });
  }

  getReceipt(receiptId: string): Promise<Receipt> {
    return this.request(`/v1/receipts/${encodeURIComponent(receiptId)}`, {
      schema: receiptSchema
    });
  }

  getLatestConformanceRun(): Promise<ConformanceRun> {
    return this.request("/v1/conformance/latest", {
      schema: conformanceRunSchema
    });
  }

  private async request<TSchema extends z.ZodType>(
    path: string,
    options: RequestOptions<TSchema>
  ): Promise<z.infer<TSchema>> {
    const requestId = createRequestId();
    const response = await this.fetchImpl(buildUrl(this.baseUrl, path, options.query), {
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-request-id": requestId
      },
      method: options.method ?? "GET"
    });

    if (!response.ok) {
      throw await parseApiError(response);
    }

    const json = (await response.json()) as unknown;
    return options.schema.parse(json);
  }
}

export const apiClient = new LumenBazaarApiClient();

function buildUrl(
  baseUrl: string,
  path: string,
  query: Record<string, string | number | boolean | null | undefined> | undefined
) {
  const url = new URL(path, `${baseUrl}/`);

  if (query !== undefined) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
}

function createRequestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `lumen-web-${crypto.randomUUID()}`;
  }

  return `lumen-web-${Date.now()}`;
}

async function parseApiError(response: Response) {
  const body = await readJson(response);
  const parsed = apiFailureSchema.safeParse(body);

  if (parsed.success) {
    return toClientError(response.status, parsed.data);
  }

  return new ApiClientError({
    code: "INTERNAL_ERROR",
    message: `Request failed with HTTP ${response.status}.`,
    status: response.status
  });
}

async function readJson(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

function toClientError(status: number, failure: ApiFailure) {
  return new ApiClientError({
    code: failure.error.code,
    details: failure.error.details,
    message: failure.error.message,
    requestId: failure.requestId,
    status
  });
}
