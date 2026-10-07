import { type z } from "zod";

import { loadRuntimeConfig, type RuntimeEnvironment } from "@/config/runtime";
import type { NetworkId } from "@/config/networks";

import {
  apiFailureSchema,
  conformanceRunSchema,
  conformanceRunsSchema,
  createResourceInputSchema,
  createSellerInputSchema,
  healthSchema,
  listResourcesQuerySchema,
  networksSchema,
  paymentPayloadSchema,
  paymentVerificationSchema,
  readinessSchema,
  receiptSchema,
  resourceSchema,
  resourcesPageSchema,
  resourceValidationResultSchema,
  searchResourcesQuerySchema,
  searchResultSchema,
  sellerSchema,
  settlementSchema,
  settlementRequestSchema,
  supportedSchema,
  verifyDomainResultSchema,
  versionSchema,
  type ApiFailure,
  type ConformanceRun,
  type CreateResourceInput,
  type CreateSellerInput,
  type ListResourcesQuery,
  type PaymentPayload,
  type PaymentVerification,
  type Readiness,
  type Receipt,
  type Resource,
  type ResourcesPage,
  type ResourceValidationResult,
  type SearchResourcesQuery,
  type SearchResult,
  type Seller,
  type Settlement,
  type SettlementRequest,
  type VerifyDomainResult
} from "./schemas";

type ApiClientOptions = {
  baseUrl?: string;
  expectedNetwork?: NetworkId;
  fetchImpl?: typeof fetch;
  mode?: RuntimeEnvironment;
  validateCompatibility?: boolean;
};

type RequestOptions<TSchema extends z.ZodType> = {
  body?: unknown;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: Record<string, string | number | boolean | null | undefined>;
  requiresCompatibility?: boolean;
  schema: TSchema;
};

export const supportedBackendApiVersion = "0.1.0";

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
  private compatibility: Promise<BackendContract> | undefined;
  private readonly expectedNetwork: NetworkId;
  private readonly fetchImpl: typeof fetch;
  private readonly mode: RuntimeEnvironment;
  private readonly validateCompatibility: boolean;

  constructor(options: ApiClientOptions = {}) {
    const config = loadRuntimeConfig();

    this.baseUrl = options.baseUrl ?? config.apiBaseUrl;
    this.expectedNetwork = options.expectedNetwork ?? config.defaultNetwork;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.mode = options.mode ?? config.environment;
    this.validateCompatibility = options.validateCompatibility ?? true;
  }

  getHealth() {
    return this.request("/health", { requiresCompatibility: false, schema: healthSchema });
  }

  getVersion() {
    return this.request("/version", { requiresCompatibility: false, schema: versionSchema });
  }

  getReadiness() {
    return this.request("/ready", { requiresCompatibility: false, schema: readinessSchema });
  }

  getNetworks() {
    return this.request("/v1/networks", { schema: networksSchema });
  }

  getSupported() {
    return this.request("/v1/supported", {
      requiresCompatibility: false,
      schema: supportedSchema
    });
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

  settlePayment(payload: SettlementRequest): Promise<Settlement> {
    return this.request("/v1/settle", {
      body: settlementRequestSchema.parse(payload),
      method: "POST",
      schema: settlementSchema
    });
  }

  getReceipt(receiptId: string): Promise<Receipt> {
    return this.request(`/v1/receipts/${encodeURIComponent(receiptId)}`, {
      schema: receiptSchema
    });
  }

  listConformanceRuns(
    query: {
      limit?: number;
      network?: ConformanceRun["network"];
      status?: ConformanceRun["status"];
    } = {}
  ): Promise<ConformanceRun[]> {
    return this.request("/v1/conformance/runs", {
      query,
      schema: conformanceRunsSchema
    });
  }

  getLatestConformanceRun(): Promise<ConformanceRun> {
    return this.listConformanceRuns({ limit: 1 }).then((runs) => {
      const latest = runs[0];

      if (latest === undefined) {
        throw new ApiClientError({
          code: "RESOURCE_NOT_FOUND",
          message: "No conformance runs are available.",
          status: 404
        });
      }

      return conformanceRunSchema.parse(latest);
    });
  }

  validateResource(input: CreateResourceInput): Promise<ResourceValidationResult> {
    const parsed = createResourceInputSchema.parse(input);

    return this.request("/v1/discovery/validate", {
      body: toDiscoveryMetadata(parsed),
      method: "POST",
      schema: resourceValidationResultSchema
    });
  }

  createResource(input: CreateResourceInput): Promise<Resource> {
    return this.request("/v1/resources", {
      body: createResourceInputSchema.parse(input),
      method: "POST",
      schema: resourceSchema
    });
  }

  private async request<TSchema extends z.ZodType>(
    path: string,
    options: RequestOptions<TSchema>
  ): Promise<z.infer<TSchema>> {
    if (options.requiresCompatibility !== false && this.validateCompatibility) {
      await this.ensureCompatible();
    }

    const requestId = createRequestId();
    let response: Response;

    try {
      response = await this.fetchImpl(buildUrl(this.baseUrl, path, options.query), {
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "x-request-id": requestId
        },
        method: options.method ?? "GET"
      });
    } catch (error) {
      if (error instanceof ApiClientError) throw error;
      throw new ApiClientError({
        code: "BACKEND_UNAVAILABLE",
        message: "The LumenBazaar backend is unavailable.",
        status: 0
      });
    }

    if (!response.ok) {
      throw await parseApiError(response);
    }

    const json = await readJson(response);
    const parsed = options.schema.safeParse(json);

    if (!parsed.success) {
      throw new ApiClientError({
        code: "INVALID_API_RESPONSE",
        details: { issues: parsed.error.issues },
        message: `The backend returned an invalid response for ${path}.`,
        requestId: response.headers.get("x-request-id") ?? undefined,
        status: response.status
      });
    }

    return parsed.data;
  }

  private ensureCompatible() {
    if (this.mode === "demo") {
      return Promise.reject(
        new ApiClientError({
          code: "DEMO_MODE",
          message: "Backend requests are disabled in explicit demo mode.",
          status: 0
        })
      );
    }

    this.compatibility ??= Promise.all([
      this.getVersion(),
      this.getReadiness(),
      this.getSupported()
    ])
      .then(([version, readiness, supported]) =>
        assertBackendCompatibility({
          expectedNetwork: this.expectedNetwork,
          mode: this.mode,
          readiness,
          supported,
          version
        })
      )
      .catch((error: unknown) => {
        this.compatibility = undefined;
        throw error;
      });

    return this.compatibility;
  }
}

export type BackendContract = {
  environment: string;
  network: NetworkId;
  version: string;
  x402Version: 2;
};

export function assertBackendCompatibility({
  expectedNetwork,
  mode,
  readiness,
  supported,
  version
}: {
  expectedNetwork: NetworkId;
  mode: RuntimeEnvironment;
  readiness: Readiness;
  supported: ReturnType<typeof supportedSchema.parse>;
  version: ReturnType<typeof versionSchema.parse>;
}): BackendContract {
  if (version.version !== supportedBackendApiVersion) {
    throw new ApiClientError({
      code: "UNSUPPORTED_BACKEND_VERSION",
      message: `Backend API ${version.version} is unsupported; expected ${supportedBackendApiVersion}.`,
      status: 409
    });
  }

  if (version.environment !== mode || readiness.environment !== mode) {
    throw new ApiClientError({
      code: "UNSUPPORTED_BACKEND_VERSION",
      message: `Backend environment does not match frontend mode ${mode}.`,
      status: 409
    });
  }

  const exactKind = supported.kinds.find(
    (kind) => kind.x402Version === 2 && kind.scheme === "exact" && kind.network === expectedNetwork
  );
  if (!readiness.ok || !readiness.capabilities.exact || exactKind === undefined) {
    throw new ApiClientError({
      code: "UNSUPPORTED_CAPABILITY",
      message: `Backend is not ready for x402 v2 exact payments on ${expectedNetwork}.`,
      status: 503
    });
  }

  return {
    environment: version.environment,
    network: expectedNetwork,
    version: version.version,
    x402Version: 2
  };
}

export const apiClient = new LumenBazaarApiClient();

function toDiscoveryMetadata(input: CreateResourceInput) {
  const { sellerId, ...resource } = input;

  return {
    metadataVersion: 1,
    sellerId,
    resource
  };
}

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
