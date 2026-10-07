import { createServer } from "node:http";

const issuer = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const payer = "GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE";
const assetContract = "CB256KDRXDO2FYJN3YBYZE5KCU46WIIE67DRP5T7HI45DRH2GM6YOJFS";
const resourceUrl = "http://127.0.0.1:8080/paid?query=stellar";
const transactionHash = "a".repeat(64);

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1:8080");
  setCors(response);
  if (request.method === "OPTIONS") {
    response.writeHead(204).end();
    return;
  }

  if (url.pathname === "/version") {
    send(response, {
      commit: "release-e2e",
      environment: "testnet",
      service: "lumenbazaar-backend",
      version: "0.1.0"
    });
    return;
  }
  if (url.pathname === "/ready") {
    const ready = { status: "ready" };
    send(response, {
      capabilities: { exact: true, upto: false },
      checks: {
        assets: ready,
        database: ready,
        horizon: ready,
        migrations: ready,
        redis: ready,
        signer: ready,
        stellarRpc: ready
      },
      environment: "testnet",
      ok: true
    });
    return;
  }
  if (url.pathname === "/v1/supported") {
    send(response, {
      extensions: ["bazaar"],
      kinds: [
        {
          extra: {
            areFeesSponsored: true,
            assets: [{ code: "USDC", contractId: assetContract, decimals: 7, issuer }]
          },
          network: "stellar:testnet",
          scheme: "exact",
          x402Version: 2
        }
      ],
      signers: { "stellar:*": [payer] }
    });
    return;
  }
  if (url.pathname === "/v1/discovery/search") {
    send(response, {
      nextCursor: null,
      partialResults: false,
      ranking: { strategy: "release-e2e" },
      resources: [{ ...resource(), ranking: { matchedTerms: ["stellar"], score: 1 } }]
    });
    return;
  }
  if (url.pathname === "/v1/resources/resource_release") {
    send(response, resource());
    return;
  }
  if (url.pathname === "/v1/receipts/receipt_release") {
    send(response, receipt());
    return;
  }

  send(response, { error: { code: "NOT_FOUND", message: url.pathname } }, 404);
});

server.listen(8080, "127.0.0.1");

function send(response, body, status = 200) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

function setCors(response) {
  response.setHeader("Access-Control-Allow-Headers", "Accept,Content-Type,x-request-id");
  response.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  response.setHeader("Access-Control-Allow-Origin", "*");
}

function resource() {
  return {
    amount: "0.0500000",
    assetCode: "USDC",
    assetIssuer: issuer,
    createdAt: "2026-10-07T16:00:00.000Z",
    description: "A deterministic resource used by the local release gate.",
    extensions: {},
    id: "resource_release",
    inputSchema: { type: "object" },
    name: "Release-gated Stellar API",
    network: "stellar:testnet",
    outputSchema: { type: "object" },
    payTo: payer,
    routeTemplate: "/paid?query={query}",
    sellerId: "seller_release",
    status: "active",
    type: "http",
    updatedAt: "2026-10-07T16:00:00.000Z",
    url: resourceUrl
  };
}

function receipt() {
  return {
    amount: "500000",
    assetCode: "USDC",
    assetIssuer: issuer,
    correlationId: "corr_release",
    createdAt: "2026-10-07T17:00:00.000Z",
    evidenceHash: "evidence_release",
    failureCode: null,
    failureReason: null,
    id: "receipt_release",
    ledger: 123456,
    network: "stellar:testnet",
    paymentAttemptId: "attempt_release",
    resourceId: "resource_release",
    sellerId: "seller_release",
    settledAt: "2026-10-07T17:00:10.000Z",
    status: "finalized",
    transactionHash,
    updatedAt: "2026-10-07T17:00:10.000Z"
  };
}
