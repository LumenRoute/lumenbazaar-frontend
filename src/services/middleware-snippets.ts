import type { ResourceDraft } from "@/services/resource-creation";
import type { JsonValue } from "@/services/api/schemas";
import { prettyJson } from "@/components/resources/schema-utils";

export type MiddlewareFramework = "express" | "fastify" | "nextjs";

function getResourceMetadata(draft: ResourceDraft): string {
  const metadata: Record<string, JsonValue> = {
    name: draft.name,
    type: draft.type
  };

  if (draft.network) {
    metadata.network = draft.network;
  }

  if (draft.assetCode || draft.assetIssuer) {
    metadata.asset = {
      code: draft.assetCode || null,
      issuer: draft.assetIssuer || null
    };
  }

  if (draft.amount) {
    metadata.amount = draft.amount;
  }

  if (draft.payTo) {
    metadata.payTo = draft.payTo;
  }

  if (draft.inputSchema) {
    metadata.inputSchema = draft.inputSchema;
  }

  if (draft.outputSchema) {
    metadata.outputSchema = draft.outputSchema;
  }

  if (draft.extensions) {
    metadata.extensions = draft.extensions;
  }

  return prettyJson(metadata);
}

export function generateExpressSnippet(draft: ResourceDraft): string {
  const resourceMetadata = getResourceMetadata(draft);
  const routeTemplate = draft.routeTemplate || "/api/resource";

  return `import express from "express";
import { LumenBazaarMiddleware } from "@lumenbazaar/seller-sdk";

const app = express();

// Resource metadata
const resourceMetadata = ${resourceMetadata};

// Initialize Lumenbazaar middleware
const lumenMiddleware = new LumenBazaarMiddleware({
  sellerSdk: {
    apiBaseUrl: process.env.LUMENBAZAAR_API_URL || "https://api.testnet.lumenbazaar.dev",
    network: "${draft.network || "stellar:testnet"}"
  }
});

// Apply payment requirement middleware
app.use(
  "${routeTemplate.replace(/{[^}]+}/g, ":param")}",
  lumenMiddleware.requirePayment(resourceMetadata)
);

// Your resource endpoint
app.get("${routeTemplate.replace(/{[^}]+}/g, ":param")}", (req, res) => {
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

  return `import Fastify from "fastify";
import { LumenBazaarPlugin } from "@lumenbazaar/seller-sdk";

const fastify = Fastify({ logger: true });

// Resource metadata
const resourceMetadata = ${resourceMetadata};

// Register Lumenbazaar plugin
await fastify.register(LumenBazaarPlugin, {
  apiBaseUrl: process.env.LUMENBAZAAR_API_URL || "https://api.testnet.lumenbazaar.dev",
  network: "${draft.network || "stellar:testnet"}"
});

// Register payment requirement hook
fastify.addHook("preHandler", async (request, reply) => {
  if (request.url.startsWith("${routeTemplate.split("{")[0]}")) {
    await fastify.lumenBazaar.requirePayment(request, reply, resourceMetadata);
  }
});

// Your resource endpoint
fastify.get("${routeTemplate.replace(/{[^}]+}/g, ":param")}", async (request, reply) => {
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
import { LumenBazaarMiddleware } from "@lumenbazaar/seller-sdk";

// Resource metadata
const resourceMetadata = ${resourceMetadata};

// Initialize middleware
const lumenMiddleware = new LumenBazaarMiddleware({
  apiBaseUrl: process.env.NEXT_PUBLIC_LUMENBAZAAR_API_URL || "https://api.testnet.lumenbazaar.dev",
  network: "${draft.network || "stellar:testnet"}"
});

// Export as API route handler
export async function GET(request: NextRequest) {
  try {
    // Verify payment requirement
    const verification = await lumenMiddleware.verifyPaymentRequirement(
      request,
      resourceMetadata
    );

    if (!verification.accepted) {
      return NextResponse.json(
        {
          error: {
            code: verification.failure?.code || "PAYMENT_REQUIRED",
            message: verification.failure?.message || "Payment required"
          }
        },
        { status: 402 }
      );
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
