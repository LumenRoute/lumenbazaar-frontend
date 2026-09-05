import type { ResourceDraft } from "@/services/resource-creation";
import type { JsonValue } from "@/services/api/schemas";
import { prettyJson } from "@/components/resources/schema-utils";

export type MiddlewareFramework = "express" | "fastify" | "nextjs";

function getResourceMetadata(draft: ResourceDraft): string {
  const metadata: Record<string, JsonValue> = {
    metadataVersion: 1,
    resource: {
      amount: draft.amount || "0.05",
      assetCode: draft.assetCode || "USDC",
      assetIssuer: draft.assetIssuer || "",
      description: draft.description,
      extensions: draft.extensions || {},
      inputSchema: draft.inputSchema || { type: "object", properties: {} },
      name: draft.name,
      network: draft.network || "stellar:testnet",
      outputSchema: draft.outputSchema || { type: "object", properties: {} },
      payTo: draft.payTo || "",
      routeTemplate: draft.routeTemplate,
      type: draft.type,
      url: draft.url
    }
  };

  return prettyJson(metadata);
}

function toFrameworkRoute(routeTemplate: string) {
  return routeTemplate.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, ":$1");
}

export function generateExpressSnippet(draft: ResourceDraft): string {
  const resourceMetadata = getResourceMetadata(draft);
  const routeTemplate = draft.routeTemplate || "/api/resource";
  const frameworkRoute = toFrameworkRoute(routeTemplate);

  return `import express from "express";
import { createExpressPaymentMiddleware, paymentRequirement } from "@lumenbazaar/seller-sdk";

const app = express();

// Resource metadata
const resourceMetadata = ${resourceMetadata};

const requirement = paymentRequirement({
  network: "${draft.network || "stellar:testnet"}",
  assetCode: "${draft.assetCode || "USDC"}",
  assetIssuer: "${draft.assetIssuer || ""}",
  amount: "${draft.amount || "0.05"}",
  payTo: "${draft.payTo || ""}"
});

// Apply payment requirement middleware
app.use("${frameworkRoute}", createExpressPaymentMiddleware(requirement));

// Your resource endpoint
app.get("${frameworkRoute}", (req, res) => {
  // Payment requirement is already enforced by middleware
  // req.payment contains verified payment information
  
  res.json({
    success: true,
    data: {
      // Your resource response
    }
  });
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});`;
}

export function generateFastifySnippet(draft: ResourceDraft): string {
  const resourceMetadata = getResourceMetadata(draft);
  const routeTemplate = draft.routeTemplate || "/api/resource";
  const frameworkRoute = toFrameworkRoute(routeTemplate);

  return `import Fastify from "fastify";
import { createFastifyPaymentMiddleware, paymentRequirement } from "@lumenbazaar/seller-sdk";

const fastify = Fastify({ logger: true });

// Resource metadata
const resourceMetadata = ${resourceMetadata};

const requirement = paymentRequirement({
  network: "${draft.network || "stellar:testnet"}",
  assetCode: "${draft.assetCode || "USDC"}",
  assetIssuer: "${draft.assetIssuer || ""}",
  amount: "${draft.amount || "0.05"}",
  payTo: "${draft.payTo || ""}"
});

await fastify.register(createFastifyPaymentMiddleware(requirement));

// Register payment requirement hook
fastify.addHook("preHandler", async (request, reply) => {
  if (request.url.startsWith("${routeTemplate.split("{")[0]}")) {
    await fastify.lumenBazaar.requirePayment(request, reply);
  }
});

// Your resource endpoint
fastify.get("${frameworkRoute}", async (request, reply) => {
  // Payment requirement is already enforced by hook
  // request.payment contains verified payment information
  
  return {
    success: true,
    data: {
      // Your resource response
    }
  };
});

await fastify.listen({ port: 3000 });
console.log("Server running on http://localhost:3000");`;
}

export function generateNextJsSnippet(draft: ResourceDraft): string {
  const resourceMetadata = getResourceMetadata(draft);

  return `import { NextRequest, NextResponse } from "next/server";
import { createNextPaymentResponse, paymentRequirement } from "@lumenbazaar/seller-sdk";

// Resource metadata
const resourceMetadata = ${resourceMetadata};

const requirement = paymentRequirement({
  network: "${draft.network || "stellar:testnet"}",
  assetCode: "${draft.assetCode || "USDC"}",
  assetIssuer: "${draft.assetIssuer || ""}",
  amount: "${draft.amount || "0.05"}",
  payTo: "${draft.payTo || ""}"
});

// Export as API route handler
export async function GET(request: NextRequest) {
  try {
    if (!request.headers.get("x-payment-required")) {
      return createNextPaymentResponse(requirement);
    }

    // Payment verified - return resource
    return NextResponse.json({
      success: true,
      data: {
        // Your resource response
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

// Export Edge config for optimal performance
export const config = {
  runtime: "nodejs"
};`;
}

export function generateSnippet(framework: MiddlewareFramework, draft: ResourceDraft): string {
  switch (framework) {
    case "express":
      return generateExpressSnippet(draft);
    case "fastify":
      return generateFastifySnippet(draft);
    case "nextjs":
      return generateNextJsSnippet(draft);
  }
}
