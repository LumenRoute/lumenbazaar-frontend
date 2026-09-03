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

export const versionSchema = z.object({
  environment: z.string(),
  service: z.string(),
  version: z.string()
});

const supportedAssetSchema = z.object({
  code: z.string(),
  decimals: z.number(),
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

export const supportedSchema = z.object({
  extensions: z.object({
    bazaar: z.boolean(),
    upto: z.boolean(),
    uptoContracts: z.array(z.string())
  }),
  schemes: z.array(
    z.object({
      assets: z.array(supportedAssetSchema),
      extensions: z.object({
        upto: z.boolean(),
        x402Version: z.string()
      }),
      name: z.literal("exact"),
      network: networkIdSchema
    })
  )
});

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

export const searchResourcesQuerySchema = listResourcesQuerySchema
  .omit({ extension: true, maxPrice: true, minPrice: true, status: true })
  .extend({
    q: z.string().optional()
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

export const paymentPayloadSchema = z.object({
  payload: z.record(z.string(), z.unknown()),
  requirement: z.record(z.string(), z.unknown())
});

export type PaymentPayload = z.infer<typeof paymentPayloadSchema>;

export const paymentVerificationSchema = z.object({
  accepted: z.boolean(),
  failure: z
    .object({
      code: errorCodeSchema,
      message: z.string()
    })
    .nullable(),
  paymentAttemptId: z.string(),
  paymentHash: z.string()
});

export type PaymentVerification = z.infer<typeof paymentVerificationSchema>;

export const settlementSchema = z.object({
  ledger: z.number().nullable(),
  paymentAttemptId: z.string(),
  receiptId: z.string(),
  status: z.enum(["pending", "settled", "failed"]),
  transactionHash: z.string().nullable()
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
  completedAt: z.string().nullable(),
  id: z.string(),
  results: z.array(
    z.object({
      code: errorCodeSchema.nullable(),
      endpoint: z.string(),
      message: z.string(),
      ok: z.boolean()
    })
  ),
  startedAt: z.string(),
  status: z.enum(["pending", "running", "passed", "failed"])
});

export type ConformanceRun = z.infer<typeof conformanceRunSchema>;
