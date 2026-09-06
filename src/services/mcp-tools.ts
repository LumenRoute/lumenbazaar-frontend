import type { JsonObject } from "@/services/api/schemas";

export type McpToolName = "search_paid_resources" | "inspect_resource" | "call_paid_resource";

export type McpToolContract = {
  budget: {
    defaultMaxAmount: string;
    maxCalls: number;
    settlementMode: "exact";
  };
  description: string;
  deterministicErrors: Array<{
    code: string;
    message: string;
  }>;
  inputSchema: JsonObject;
  name: McpToolName;
  outputSchema: JsonObject;
};

export const mcpServerMetadata = {
  name: "lumenbazaar-mcp",
  protocol: "Model Context Protocol",
  resourceDiscovery: "Bazaar off-chain index",
  settlementAdapter: "@x402/stellar",
  version: "0.1.0"
};

export const mcpToolContracts: McpToolContract[] = [
  {
    budget: {
      defaultMaxAmount: "1.0000000",
      maxCalls: 10,
      settlementMode: "exact"
    },
    description: "Search indexed paid HTTP APIs and MCP tools with Bazaar metadata filters.",
    deterministicErrors: [
      {
        code: "RATE_LIMITED",
        message: "Budget exhausted before discovery completed."
      },
      {
        code: "VALIDATION_FAILED",
        message: "Search query or filter shape is invalid."
      }
    ],
    inputSchema: {
      properties: {
        asset: { type: "string" },
        limit: { maximum: 25, minimum: 1, type: "integer" },
        network: { enum: ["stellar:testnet", "stellar:pubnet"], type: "string" },
        q: { type: "string" },
        type: { enum: ["http", "mcp"], type: "string" }
      },
      required: ["q"],
      type: "object"
    },
    name: "search_paid_resources",
    outputSchema: {
      properties: {
        resources: { type: "array" },
        nextCursor: { type: ["string", "null"] }
      },
      required: ["resources", "nextCursor"],
      type: "object"
    }
  },
  {
    budget: {
      defaultMaxAmount: "0.0000000",
      maxCalls: 20,
      settlementMode: "exact"
    },
    description: "Inspect a paid resource, including schemas and x402 payment requirements.",
    deterministicErrors: [
      {
        code: "RESOURCE_NOT_FOUND",
        message: "The resource ID is not indexed."
      },
      {
        code: "SELLER_DOMAIN_UNVERIFIED",
        message: "The seller domain cannot be trusted for paid execution."
      }
    ],
    inputSchema: {
      properties: {
        resourceId: { type: "string" }
      },
      required: ["resourceId"],
      type: "object"
    },
    name: "inspect_resource",
    outputSchema: {
      properties: {
        paymentRequirements: { type: "object" },
        resource: { type: "object" }
      },
      required: ["resource", "paymentRequirements"],
      type: "object"
    }
  },
  {
    budget: {
      defaultMaxAmount: "0.5000000",
      maxCalls: 3,
      settlementMode: "exact"
    },
    description: "Call a paid resource after exact x402 verification and settlement.",
    deterministicErrors: [
      {
        code: "PAYMENT_REQUIRED",
        message: "The tool call requires an x402 authorization payload."
      },
      {
        code: "SETTLEMENT_FAILED",
        message: "The Stellar payment could not be settled."
      },
      {
        code: "REPLAY_DETECTED",
        message: "The authorization payload has already been consumed."
      }
    ],
    inputSchema: {
      properties: {
        arguments: { type: "object" },
        maxAmount: { type: "string" },
        paymentPayload: { type: "object" },
        resourceId: { type: "string" }
      },
      required: ["resourceId", "arguments", "paymentPayload"],
      type: "object"
    },
    name: "call_paid_resource",
    outputSchema: {
      properties: {
        receipt: { type: "object" },
        result: { type: "object" },
        settlement: { type: "object" }
      },
      required: ["result", "settlement", "receipt"],
      type: "object"
    }
  }
];

export function findMcpTool(name: McpToolName) {
  return mcpToolContracts.find((tool) => tool.name === name);
}

export function toolBudgetCeiling() {
  return mcpToolContracts.reduce((sum, tool) => sum + Number(tool.budget.defaultMaxAmount), 0);
}
