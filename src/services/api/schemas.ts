import { z } from "zod";

import { networkIdSchema } from "@/config/networks";

export const errorCodeSchema = z.enum([
  "PAYMENT_REQUIRED",
  "UNSUPPORTED_NETWORK",
  "UNSUPPORTED_ASSET",
  "INVALID_PAYMENT_PAYLOAD",
  "INVALID_SIGNATURE",
  "AUTH_EXPIRED",
  "REPLAY_DETECTED",
  "AMOUNT_MISMATCH",
  "ASSET_MISMATCH",
  "RECIPIENT_MISMATCH",
  "SETTLEMENT_FAILED",
  "TRUSTLINE_REQUIRED",
  "RESOURCE_NOT_FOUND",
  "SELLER_NOT_FOUND",
  "SELLER_DOMAIN_UNVERIFIED",
  "CATALOG_VALIDATION_FAILED",
  "ROUTE_TEMPLATE_INVALID",
  "VALIDATION_FAILED",
  "RATE_LIMITED",
  "INTERNAL_ERROR"
]);

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    jsonObjectSchema
  ])
);

export const jsonObjectSchema: z.ZodType<JsonObject> = z.record(z.string(), jsonValueSchema);

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | {
      [key: string]: JsonValue;
    };

export type JsonObject = {
  [key: string]: JsonValue;
};

export const apiFailureSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    details: z.record(z.string(), z.unknown()).optional(),
    message: z.string()
  }),
  ok: z.literal(false),
  requestId: z.string().optional()
});

export type ApiFailure = z.infer<typeof apiFailureSchema>;
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const healthSchema = z.object({
  app: z.string(),
  dependencies: z.object({
    database: z.string(),
    redis: z.string()
  }),
  ok: z.boolean(),
  service: z.string()
});

export type Health = z.infer<typeof healthSchema>;

export const versionSchema = z.object({
  environment: z.string(),
  service: z.string(),
  version: z.string()
});

export type Version = z.infer<typeof versionSchema>;

const supportedAssetSchema = z.object({
  code: z.string(),
  decimals: z.number(),
  contractId: z.string().optional(),
  issuer: z.string()
});

export const networksSchema = z.object({
  networks: z.array(
    z.object({
      assets: z.array(supportedAssetSchema),
      displayName: z.string(),
      horizonUrl: z.string().url(),
      id: networkIdSchema,
      passphrase: z.string(),
      rpcUrl: z.string().url()
    })
  )
});

export type NetworksResponse = z.infer<typeof networksSchema>;

export const supportedSchema = z.object({
  extensions: z.object({
    bazaar: z.boolean(),
    upto: z.boolean(),
    uptoContracts: z.array(
      z.union([
        z.string(),
        z.object({
          contractId: z.string(),
          network: networkIdSchema
        })
      ])
    )
  }),
  schemes: z.array(
    z.object({
      assets: z.array(supportedAssetSchema),
      extensions: z.record(z.string(), z.unknown()),
      name: z.enum(["exact", "upto"]),
      network: networkIdSchema
    })
  )
});

export type SupportedPaymentSchemes = z.infer<typeof supportedSchema>;

export const sellerSchema = z.object({
  createdAt: z.string(),
  displayName: z.string(),
  domain: z.string(),
  domainVerifiedAt: z.string().nullable(),
  id: z.string(),
  updatedAt: z.string(),
  walletAddress: z.string()
});

export type Seller = z.infer<typeof sellerSchema>;

export const createSellerInputSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  domain: z.string().trim().min(1),
  walletAddress: z.string().trim().min(1)
});

export type CreateSellerInput = z.infer<typeof createSellerInputSchema>;

export const verifyDomainResultSchema = z.object({
  challenge: z.string(),
  challengeToken: z.string(),
  domain: z.string(),
  domainVerifiedAt: z.string().nullable(),
  method: z.enum(["well-known", "dns"]),
  sellerId: z.string(),
  verified: z.boolean()
});

export type VerifyDomainResult = z.infer<typeof verifyDomainResultSchema>;

export const resourceTypeSchema = z.enum(["http", "mcp"]);
export const resourceStatusSchema = z.enum(["draft", "active", "inactive"]);
export type ResourceType = z.infer<typeof resourceTypeSchema>;
export type ResourceStatus = z.infer<typeof resourceStatusSchema>;

export const resourceSchema = z.object({
  amount: z.string(),
  assetCode: z.string(),
  assetIssuer: z.string(),
  createdAt: z.string(),
  description: z.string(),
  extensions: jsonObjectSchema,
  id: z.string(),
  inputSchema: jsonObjectSchema,
  name: z.string(),
  network: networkIdSchema,
  outputSchema: jsonObjectSchema,
  payTo: z.string(),
  routeTemplate: z.string(),
  sellerId: z.string(),
  status: resourceStatusSchema,
  type: resourceTypeSchema,
  updatedAt: z.string(),
  url: z.string().url()
});

export type Resource = z.infer<typeof resourceSchema>;

export const paymentRequirementSchema = z.object({
  amount: z.string(),
  assetCode: z.string(),
  assetIssuer: z.string(),
  expiresAtLedger: z.number().nullable(),
  extensions: jsonObjectSchema,
  network: networkIdSchema,
  payTo: z.string(),
  resourceId: z.string(),
  scheme: z.enum(["exact", "upto"]),
  x402Version: z.string()
});

export type PaymentRequirement = z.infer<typeof paymentRequirementSchema>;

export const listResourcesQuerySchema = z.object({
  asset: z.string().optional(),
  cursor: z.string().optional(),
  extension: z.string().optional(),
  limit: z.number().int().positive().max(100).optional(),
  maxPrice: z.string().optional(),
  minPrice: z.string().optional(),
  network: networkIdSchema.optional(),
  sellerId: z.string().optional(),
  status: resourceStatusSchema.optional(),
  type: resourceTypeSchema.optional()
});

export type ListResourcesQuery = z.infer<typeof listResourcesQuerySchema>;

export const resourcesPageSchema = z.object({
  nextCursor: z.string().nullable(),
  resources: z.array(resourceSchema)
});

export type ResourcesPage = z.infer<typeof resourcesPageSchema>;

export const searchResourcesQuerySchema = listResourcesQuerySchema.omit({ status: true }).extend({
  q: z.string().optional(),
  sellerVerified: z.boolean().optional()
});

export type SearchResourcesQuery = z.infer<typeof searchResourcesQuerySchema>;

export const rankedResourceSchema = resourceSchema.extend({
  ranking: z.object({
    matchedTerms: z.array(z.string()),
    score: z.number()
  })
});

export const searchResultSchema = z.object({
  nextCursor: z.string().nullable(),
  partialResults: z.boolean(),
  ranking: z.object({
    strategy: z.string()
  }),
  resources: z.array(rankedResourceSchema)
});

export type SearchResult = z.infer<typeof searchResultSchema>;

export const exactPaymentPayloadSchema = z.object({
  amount: z.string(),
  asset: z.object({
    code: z.string(),
    issuer: z.string()
  }),
  authorization: z.record(z.string(), z.unknown()).optional(),
  expiresAtLedger: z.number().int().positive().optional(),
  memo: z.string().optional(),
  network: networkIdSchema,
  payTo: z.string(),
  paymentHash: z.string().optional(),
  scheme: z.literal("exact")
});

export const exactPaymentRequirementsSchema = z.object({
  amount: z.string(),
  asset: z
    .object({
      code: z.string(),
      issuer: z.string()
    })
    .optional(),
  network: networkIdSchema,
  payTo: z.string(),
  scheme: z.literal("exact")
});

export const paymentPayloadSchema = z.object({
  currentLedger: z.number().int().nonnegative().optional(),
  paymentPayload: exactPaymentPayloadSchema,
  paymentRequirements: exactPaymentRequirementsSchema,
  resourceId: z.string().optional(),
  sellerId: z.string().optional()
});

export type PaymentPayload = z.infer<typeof paymentPayloadSchema>;

export const paymentVerificationSchema = z.object({
  adapter: z.literal("@x402/stellar"),
  network: networkIdSchema,
  paymentAttemptId: z.string(),
  paymentHash: z.string(),
  status: z.literal("verified")
});

export type PaymentVerification = z.infer<typeof paymentVerificationSchema>;

export const settlementRequestSchema = paymentPayloadSchema.extend({
  paymentAttemptId: z.string().min(1)
});

export type SettlementRequest = z.infer<typeof settlementRequestSchema>;

export const settlementSchema = z.object({
  ledger: z.number(),
  network: networkIdSchema,
  paymentAttemptId: z.string(),
  receiptId: z.string(),
  settlementId: z.string(),
  status: z.literal("settled"),
  transactionHash: z.string()
});

export type Settlement = z.infer<typeof settlementSchema>;

export const receiptSchema = z.object({
  amount: z.string(),
  assetCode: z.string(),
  assetIssuer: z.string(),
  createdAt: z.string(),
  failureCode: z.string().nullable(),
  failureReason: z.string().nullable(),
  id: z.string(),
  ledger: z.number().nullable(),
  network: networkIdSchema,
  paymentAttemptId: z.string(),
  resourceId: z.string().nullable(),
  sellerId: z.string().nullable(),
  settledAt: z.string().nullable(),
  status: z.enum(["pending", "finalized", "failed"]),
  transactionHash: z.string().nullable(),
  updatedAt: z.string()
});

export type Receipt = z.infer<typeof receiptSchema>;

export const conformanceRunSchema = z.object({
  completedAt: z.string(),
  createdAt: z.string(),
  exactResults: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  id: z.string(),
  network: networkIdSchema,
  passedCount: z.number().int().nonnegative(),
  reservedCount: z.number().int().nonnegative(),
  results: z.array(
    z.object({
      description: z.string().optional(),
      details: jsonObjectSchema.optional(),
      durationMs: z.number().int().nonnegative(),
      endpoint: z.string(),
      error: z.string().optional(),
      id: z.string(),
      method: z.enum(["GET", "POST"]),
      name: z.string(),
      network: networkIdSchema,
      passed: z.boolean(),
      reserved: z.boolean().optional(),
      scheme: z.enum(["exact", "upto"]),
      status: z.enum(["passed", "failed", "reserved"])
    })
  ),
  startedAt: z.string(),
  status: z.enum(["passed", "failed"]),
  suite: z.literal("stellar-x402")
});

export const conformanceRunsSchema = z.array(conformanceRunSchema);

export type ConformanceRun = z.infer<typeof conformanceRunSchema>;

export const createResourceInputSchema = z.object({
  sellerId: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(1000),
  type: resourceTypeSchema,
  url: z.string().url(),
  routeTemplate: z.string().min(1),
  network: networkIdSchema,
  assetCode: z.string().min(1),
  assetIssuer: z.string().min(1),
  amount: z.string().min(1),
  payTo: z.string().min(1),
  inputSchema: jsonObjectSchema,
  outputSchema: jsonObjectSchema,
  extensions: jsonObjectSchema.optional()
});

export type CreateResourceInput = z.infer<typeof createResourceInputSchema>;

const resourceValidationIssueSchema = z
  .object({
    code: z.string().optional(),
    field: z.string().optional(),
    message: z.string(),
    path: z.array(z.string()).optional()
  })
  .transform((issue) => ({
    field: issue.field ?? issue.path?.join(".") ?? issue.code ?? "general",
    message: issue.message,
    ...(issue.code === undefined ? {} : { code: issue.code })
  }));

export const resourceValidationResultSchema = z
  .object({
    errors: z.array(resourceValidationIssueSchema).optional(),
    ok: z.boolean().optional(),
    valid: z.boolean().optional(),
    warnings: z.array(resourceValidationIssueSchema).optional()
  })
  .transform((result) => ({
    valid: result.valid ?? result.ok ?? false,
    errors: result.errors ?? [],
    warnings: result.warnings ?? []
  }));

export type ResourceValidationResult = z.infer<typeof resourceValidationResultSchema>;
