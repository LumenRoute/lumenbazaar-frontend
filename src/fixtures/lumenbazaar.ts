import {
  conformanceRunSchema,
  receiptSchema,
  resourceSchema,
  sellerSchema,
  type ConformanceRun,
  type Receipt,
  type Resource,
  type Seller
} from "@/services/api/schemas";

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

export const demoPaymentRequirements = demoResources.map((resource) => ({
  amount: resource.amount,
  assetCode: resource.assetCode,
  assetIssuer: resource.assetIssuer,
  expiresAtLedger: 0,
  extensions: resource.extensions,
  network: resource.network,
  payTo: resource.payTo,
  resourceId: resource.id,
  scheme: "exact" as const,
  x402Version: "1"
}));

export const demoReceipts: Receipt[] = [
  receiptSchema.parse({
    amount: "0.0500000",
    assetCode: "USDC",
    assetIssuer: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    createdAt: "2026-09-02T16:00:00.000Z",
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
  id: "conformance_local_demo",
  results: [
    {
      code: null,
      endpoint: "/v1/supported",
      message: "Exact scheme advertised for stellar:testnet.",
      ok: true
    },
    {
      code: null,
      endpoint: "/v1/verify",
      message: "Verification returns accepted and stable rejection states.",
      ok: true
    },
    {
      code: null,
      endpoint: "/v1/settle",
      message: "Settlement returns receipt identifiers and transaction metadata.",
      ok: true
    }
  ],
  startedAt: "2026-09-02T16:04:30.000Z",
  status: "passed"
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

export function findDemoResource(resourceId: string) {
  return demoResources.find((resource) => resource.id === resourceId);
}

export function findDemoSeller(sellerId: string) {
  return demoSellers.find((seller) => seller.id === sellerId);
}
