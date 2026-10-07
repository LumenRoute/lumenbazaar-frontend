import {
  conformanceRunSchema,
  receiptSchema,
  resourceSchema,
  sellerSchema,
  supportedSchema,
  type ConformanceRun,
  type Receipt,
  type Resource,
  type ResourcePaymentSummary,
  type Seller,
  type SupportedPaymentSchemes
} from "@/services/api/schemas";

export type DemoPaymentAttempt = {
  id: string;
  resourceId: string;
  sellerId: string;
  paymentHash: string;
  network: Resource["network"];
  assetCode: string;
  assetIssuer: string;
  amount: string;
  payTo: string;
  status: "received" | "verified" | "settled" | "failed";
  failureCode: string | null;
  failureReason: string | null;
  expiresAtLedger: number | null;
  createdAt: string;
  updatedAt: string;
};

export type DemoSettlement = {
  id: string;
  paymentAttemptId: string;
  transactionHash: string | null;
  ledger: number | null;
  network: Resource["network"];
  amount: string;
  assetCode: string;
  assetIssuer: string;
  status: "pending" | "settled" | "failed";
  settledAt: string | null;
  createdAt: string;
};

export const demoSellers: Seller[] = [
  sellerSchema.parse({
    createdAt: "2026-09-02T12:00:00.000Z",
    displayName: "Atlas Weather Lab",
    domain: "weather.lumenbazaar.dev",
    domainVerifiedAt: "2026-09-02T12:30:00.000Z",
    id: "seller_atlas_weather",
    updatedAt: "2026-09-02T12:30:00.000Z",
    walletAddress: "GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE"
  }),
  sellerSchema.parse({
    createdAt: "2026-09-02T13:00:00.000Z",
    displayName: "Vector RAG Index",
    domain: "rag.lumenbazaar.dev",
    domainVerifiedAt: null,
    id: "seller_vector_rag",
    updatedAt: "2026-09-02T13:00:00.000Z",
    walletAddress: "GDNQZCIXGRK7X5WJZVQVQGTU7BA3D47XAZ7VTTVXB5T5H2L5XRR7YDUA"
  })
];

export const demoResources: Resource[] = [
  resourceSchema.parse({
    amount: "0.0500000",
    assetCode: "USDC",
    assetIssuer: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    createdAt: "2026-09-02T14:00:00.000Z",
    description: "Returns current weather observations for a city with source and freshness data.",
    extensions: {
      bazaar: true,
      metadataQuality: 0.96,
      recentSettlementStatus: "settled",
      trusted: true
    },
    id: "resource_weather_lagos",
    inputSchema: {
      properties: {
        city: {
          examples: ["Lagos"],
          type: "string"
        }
      },
      required: ["city"],
      type: "object"
    },
    name: "Paid Weather API",
    network: "stellar:testnet",
    outputSchema: {
      properties: {
        city: {
          type: "string"
        },
        source: {
          type: "string"
        },
        temperatureC: {
          type: "number"
        }
      },
      required: ["city", "temperatureC", "source"],
      type: "object"
    },
    payTo: "GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE",
    routeTemplate: "/weather/{city}",
    sellerId: "seller_atlas_weather",
    status: "active",
    type: "http",
    updatedAt: "2026-09-02T14:00:00.000Z",
    url: "https://weather.lumenbazaar.dev/weather/{city}"
  }),
  resourceSchema.parse({
    amount: "0.1200000",
    assetCode: "USDC",
    assetIssuer: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    createdAt: "2026-09-02T15:00:00.000Z",
    description: "Searches a curated Stellar development corpus and returns cited passages.",
    extensions: {
      bazaar: true,
      metadataQuality: 0.89,
      mcp: {
        serverName: "lumen-rag-demo",
        toolName: "search_stellar_docs"
      },
      recentSettlementStatus: "pending",
      trusted: false
    },
    id: "resource_stellar_rag",
    inputSchema: {
      properties: {
        query: {
          type: "string"
        },
        topK: {
          maximum: 10,
          minimum: 1,
          type: "integer"
        }
      },
      required: ["query"],
      type: "object"
    },
    name: "Stellar RAG Search",
    network: "stellar:testnet",
    outputSchema: {
      properties: {
        citations: {
          items: {
            type: "string"
          },
          type: "array"
        },
        answer: {
          type: "string"
        }
      },
      required: ["answer", "citations"],
      type: "object"
    },
    payTo: "GDNQZCIXGRK7X5WJZVQVQGTU7BA3D47XAZ7VTTVXB5T5H2L5XRR7YDUA",
    routeTemplate: "mcp://lumen-rag-demo/search_stellar_docs",
    sellerId: "seller_vector_rag",
    status: "active",
    type: "mcp",
    updatedAt: "2026-09-02T15:00:00.000Z",
    url: "https://rag.lumenbazaar.dev/mcp"
  })
];

export const demoPaymentRequirements: ResourcePaymentSummary[] = demoResources.map((resource) => ({
  amount: resource.amount,
  assetCode: resource.assetCode,
  assetIssuer: resource.assetIssuer,
  extensions: resource.extensions,
  network: resource.network,
  payTo: resource.payTo,
  resourceId: resource.id
}));

export const demoSupportedPaymentSchemes: SupportedPaymentSchemes = supportedSchema.parse({
  extensions: ["bazaar"],
  kinds: [
    {
      extra: {
        areFeesSponsored: true,
        assets: [
          {
            code: "USDC",
            contractId: "CASSETDEMO",
            decimals: 7,
            issuer: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
          }
        ]
      },
      network: "stellar:testnet",
      scheme: "exact",
      x402Version: 2
    }
  ],
  signers: {
    "stellar:*": ["GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"]
  }
});

export const demoPaymentAttempts: DemoPaymentAttempt[] = [
  {
    id: "attempt_weather_001",
    resourceId: "resource_weather_lagos",
    sellerId: "seller_atlas_weather",
    paymentHash: "8f1f79be0e3dcf4f62adf0b7558e36457a6682620dd9b178f01e8012c6e65b42",
    network: "stellar:testnet",
    assetCode: "USDC",
    assetIssuer: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    amount: "0.0500000",
    payTo: "GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE",
    status: "settled",
    failureCode: null,
    failureReason: null,
    expiresAtLedger: 113260,
    createdAt: "2026-09-02T16:00:00.000Z",
    updatedAt: "2026-09-02T16:00:09.000Z"
  },
  {
    id: "attempt_rag_001",
    resourceId: "resource_stellar_rag",
    sellerId: "seller_vector_rag",
    paymentHash: "f537d6f0b9f9d918ee3da577d5b820e2c1478abaf22c0ec0978c0848b712ad35",
    network: "stellar:testnet",
    assetCode: "USDC",
    assetIssuer: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    amount: "0.1200000",
    payTo: "GDNQZCIXGRK7X5WJZVQVQGTU7BA3D47XAZ7VTTVXB5T5H2L5XRR7YDUA",
    status: "verified",
    failureCode: null,
    failureReason: null,
    expiresAtLedger: 113285,
    createdAt: "2026-09-02T16:02:00.000Z",
    updatedAt: "2026-09-02T16:02:02.000Z"
  },
  {
    id: "attempt_weather_failed_001",
    resourceId: "resource_weather_lagos",
    sellerId: "seller_atlas_weather",
    paymentHash: "9c82a602d0950f6b3deedff50e52c4dd2d5b6b1b37d30a2a8d51d42e76d8a930",
    network: "stellar:testnet",
    assetCode: "USDC",
    assetIssuer: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    amount: "0.0500000",
    payTo: "GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE",
    status: "failed",
    failureCode: "AUTH_EXPIRED",
    failureReason: "Authorization expired before settlement.",
    expiresAtLedger: 113200,
    createdAt: "2026-09-02T15:58:00.000Z",
    updatedAt: "2026-09-02T15:58:30.000Z"
  }
];

export const demoSettlements: DemoSettlement[] = [
  {
    id: "settlement_weather_001",
    paymentAttemptId: "attempt_weather_001",
    transactionHash: "8b54ad6f02d48fef51d92f2db1a4d4d069e9449ce9a4f27b9a6c6e6d88f9d631",
    ledger: 113245,
    network: "stellar:testnet",
    amount: "0.0500000",
    assetCode: "USDC",
    assetIssuer: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    status: "settled",
    settledAt: "2026-09-02T16:00:09.000Z",
    createdAt: "2026-09-02T16:00:09.000Z"
  }
];

export const demoReceipts: Receipt[] = [
  receiptSchema.parse({
    amount: "0.0500000",
    assetCode: "USDC",
    assetIssuer: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    correlationId: "corr_demo_weather_001",
    createdAt: "2026-09-02T16:00:00.000Z",
    evidenceHash: "8f1f79be0e3dcf4f62adf0b7558e36457a6682620dd9b178f01e8012c6e65b42",
    failureCode: null,
    failureReason: null,
    id: "receipt_weather_001",
    ledger: 113245,
    network: "stellar:testnet",
    paymentAttemptId: "attempt_weather_001",
    resourceId: "resource_weather_lagos",
    sellerId: "seller_atlas_weather",
    settledAt: "2026-09-02T16:00:09.000Z",
    status: "finalized",
    transactionHash: "8b54ad6f02d48fef51d92f2db1a4d4d069e9449ce9a4f27b9a6c6e6d88f9d631",
    updatedAt: "2026-09-02T16:00:09.000Z"
  })
];

export const demoConformanceRun: ConformanceRun = conformanceRunSchema.parse({
  completedAt: "2026-09-02T16:05:00.000Z",
  createdAt: "2026-09-02T16:05:00.000Z",
  exactResults: 3,
  failedCount: 0,
  id: "conformance_local_demo",
  network: "stellar:testnet",
  passedCount: 3,
  reservedCount: 3,
  results: [
    {
      description: "Checks that the facilitator advertises exact Stellar x402 support.",
      durationMs: 18,
      endpoint: "/v1/supported",
      id: "exact-supported",
      method: "GET",
      name: "GET /v1/supported returns exact scheme",
      network: "stellar:testnet",
      passed: true,
      scheme: "exact",
      status: "passed"
    },
    {
      description: "Checks that exact payment verification accepts valid Stellar payloads.",
      durationMs: 31,
      endpoint: "/v1/verify",
      id: "exact-verify",
      method: "POST",
      name: "POST /v1/verify accepts exact payload",
      network: "stellar:testnet",
      passed: true,
      scheme: "exact",
      status: "passed"
    },
    {
      description: "Checks that exact settlement returns receipt and transaction evidence.",
      durationMs: 92,
      endpoint: "/v1/settle",
      id: "exact-settle",
      method: "POST",
      name: "POST /v1/settle settles exact payload",
      network: "stellar:testnet",
      passed: true,
      scheme: "exact",
      status: "passed"
    },
    {
      description: "Reserved until capped session support is enabled by the backend.",
      durationMs: 0,
      endpoint: "/v1/supported",
      id: "upto-supported",
      method: "GET",
      name: "GET /v1/supported advertises upto readiness",
      network: "stellar:testnet",
      passed: false,
      reserved: true,
      scheme: "upto",
      status: "reserved"
    },
    {
      description: "Reserved until capped session creation is available.",
      durationMs: 0,
      endpoint: "/v1/payment-sessions",
      id: "upto-session-create",
      method: "POST",
      name: "POST /v1/payment-sessions creates upto session",
      network: "stellar:testnet",
      passed: false,
      reserved: true,
      scheme: "upto",
      status: "reserved"
    },
    {
      description: "Reserved until capped session settlement is available.",
      durationMs: 0,
      endpoint: "/v1/payment-sessions/{sessionId}/settle",
      id: "upto-settle",
      method: "POST",
      name: "POST /v1/payment-sessions/{sessionId}/settle processes upto draw",
      network: "stellar:testnet",
      passed: false,
      reserved: true,
      scheme: "upto",
      status: "reserved"
    }
  ],
  startedAt: "2026-09-02T16:04:30.000Z",
  status: "passed",
  suite: "stellar-x402"
});

export const demoDashboardMetrics = {
  activeSellerCount: demoSellers.filter((seller) => seller.domainVerifiedAt !== null).length,
  apiUptimeSeconds: 98_400,
  indexedResourceCount: demoResources.length,
  latestConformanceStatus: demoConformanceRun.status,
  settledPaymentCount: demoReceipts.filter((receipt) => receipt.status === "finalized").length,
  settlementVolumeByNetwork: {
    "stellar:testnet": demoReceipts.reduce((sum, receipt) => sum + Number(receipt.amount), 0)
  },
  supportedNetworks: ["stellar:testnet"]
};

export const demoOperatorMetrics = {
  queueDepth: {
    "settlement-confirmation": 2,
    "resource-indexing": 1,
    "search-sync": 0
  },
  rpcErrorCount: 0,
  searchLatencyP95Ms: 42,
  settlementLatencyP95Ms: 680,
  settlementSuccessRate: 0.97
};

export const demoHealthRows = [
  {
    name: "API",
    status: "operational" as const,
    checkedAt: "2026-09-02T16:06:00.000Z",
    detail: "Health endpoint returned ok."
  },
  {
    name: "Worker",
    status: "operational" as const,
    checkedAt: "2026-09-02T16:05:55.000Z",
    detail: "Queues are draining within baseline."
  },
  {
    name: "Search",
    status: "degraded" as const,
    checkedAt: "2026-09-02T16:05:50.000Z",
    detail: "Explicit demo-mode fixture search is active."
  },
  {
    name: "Redis",
    status: "operational" as const,
    checkedAt: "2026-09-02T16:05:45.000Z",
    detail: "Connection configured."
  },
  {
    name: "Postgres",
    status: "operational" as const,
    checkedAt: "2026-09-02T16:05:40.000Z",
    detail: "Connection configured."
  },
  {
    name: "RPC",
    status: "operational" as const,
    checkedAt: "2026-09-02T16:05:35.000Z",
    detail: "Stellar testnet RPC configured."
  },
  {
    name: "Horizon",
    status: "operational" as const,
    checkedAt: "2026-09-02T16:05:30.000Z",
    detail: "Stellar testnet Horizon configured."
  }
];

export function findDemoResource(resourceId: string) {
  return demoResources.find((resource) => resource.id === resourceId);
}

export function findDemoSeller(sellerId: string) {
  return demoSellers.find((seller) => seller.id === sellerId);
}

export function findDemoReceiptByAttempt(paymentAttemptId: string) {
  return demoReceipts.find((receipt) => receipt.paymentAttemptId === paymentAttemptId);
}

export function findDemoSettlementByAttempt(paymentAttemptId: string) {
  return demoSettlements.find((settlement) => settlement.paymentAttemptId === paymentAttemptId);
}
