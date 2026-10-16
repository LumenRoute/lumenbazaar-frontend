import { encodePaymentRequiredHeader } from "@x402/core/http";
import type { PaymentRequired } from "@x402/core/types";
import { expect, test, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { redactSensitiveDataInDOM } from "./screenshot-redaction";

const resourceUrl = "http://127.0.0.1:8080/paid?query=stellar";
const assetContract = "CB256KDRXDO2FYJN3YBYZE5KCU46WIIE67DRP5T7HI45DRH2GM6YOJFS";
const issuer = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const payer = "GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE";
const transactionHash = "a".repeat(64);

// Ensure screenshots directory exists
const screenshotsDir = path.join(process.cwd(), "test-results", "screenshots");
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

test.beforeEach(async ({ page }) => {
  await installFreighterProtocolStub(page);
});

test("dashboard state - authenticated user overview", async ({ page, browserName }) => {
  const variant = browserName === "chromium" ? "desktop" : "mobile";
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "LumenBazaar" })).toBeVisible();
  await page.waitForLoadState("networkidle");

  await captureScreenshot(page, `dashboard-${variant}.png`);
});

test("explore discovery - resource listing and search", async ({ page, browserName }) => {
  const variant = browserName === "chromium" ? "desktop" : "mobile";
  await page.goto("/explore");

  await expect(page.getByRole("heading", { name: "Explore" })).toBeVisible();
  await expect(page.getByLabel("Search resources")).toBeVisible();
  await page.waitForLoadState("networkidle");

  await captureScreenshot(page, `explore-discovery-${variant}.png`);
});

test("resource detail view - payment terms and challenge display", async ({
  page,
  browserName
}) => {
  const variant = browserName === "chromium" ? "desktop" : "mobile";
  await installPaidResourceRoute(page, "challenge");
  await page.goto("/explore");

  await expect(page.getByText("Release-gated Stellar API")).toBeVisible();
  await page.getByRole("link", { name: "Inspect", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Resource detail" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Payment terms" })).toBeVisible();
  await page.waitForLoadState("networkidle");

  await captureScreenshot(page, `payment-terms-display-${variant}.png`);
});

test("wallet connection state - connection confirmation UI", async ({
  page,
  browserName
}) => {
  const variant = browserName === "chromium" ? "desktop" : "mobile";
  await installPaidResourceRoute(page, "challenge");
  await page.goto("/explore");

  await page.getByRole("link", { name: "Inspect", exact: true }).click();
  await page.getByRole("button", { name: "Connect Freighter" }).click();

  await expect(page.getByText("Wallet connected")).toBeVisible();
  await page.waitForLoadState("networkidle");

  await captureScreenshot(page, `wallet-connected-${variant}.png`);
});

test("payment validation - terms verified and ready state", async ({
  page,
  browserName
}) => {
  const variant = browserName === "chromium" ? "desktop" : "mobile";
  await installPaidResourceRoute(page, "challenge");
  await page.goto("/explore");

  await page.getByRole("link", { name: "Inspect", exact: true }).click();
  await page.getByRole("button", { name: "Connect Freighter" }).click();
  await expect(page.getByText("Wallet connected")).toBeVisible();

  await page.getByRole("button", { name: "Request terms" }).click();
  await expect(page.getByText("Validated x402 v2 exact")).toBeVisible();
  await page.waitForLoadState("networkidle");

  await captureScreenshot(page, `payment-validated-${variant}.png`);
});

test("receipt recovery - durable receipt display after reload", async ({
  page,
  browserName
}) => {
  const variant = browserName === "chromium" ? "desktop" : "mobile";
  await installPaidResourceRoute(page, "challenge");
  await page.goto("/explore");

  await page.getByRole("link", { name: "Inspect", exact: true }).click();
  await page.getByRole("button", { name: "Connect Freighter" }).click();
  await expect(page.getByText("Wallet connected")).toBeVisible();

  await page.getByRole("button", { name: "Request terms" }).click();
  await expect(page.getByText("Validated x402 v2 exact")).toBeVisible();

  // Inject durable receipt into session storage
  await page.evaluate(
    ({ hash, resourceId }) => {
      window.sessionStorage.setItem(
        `lumenbazaar:payment-recovery:${resourceId}`,
        JSON.stringify({
          correlationId: "corr_release",
          network: "stellar:testnet",
          paymentAttemptId: "attempt_release",
          receiptId: "receipt_release",
          resourceId,
          stage: "submitted",
          transactionHash: hash,
          updatedAt: "2026-10-07T17:00:00.000Z"
        })
      );
    },
    { hash: transactionHash, resourceId: "resource_release" }
  );

  await page.reload();
  await expect(page.getByText("Payment settled with a durable receipt.")).toBeVisible();
  await page.waitForLoadState("networkidle");

  await captureScreenshot(page, `receipt-recovered-${variant}.png`);
});

test("receipt detail view - transaction evidence and explorer link", async ({
  page,
  browserName
}) => {
  const variant = browserName === "chromium" ? "desktop" : "mobile";
  await installPaidResourceRoute(page, "challenge");
  await page.goto("/explore");

  await page.getByRole("link", { name: "Inspect", exact: true }).click();
  await page.getByRole("button", { name: "Connect Freighter" }).click();
  await expect(page.getByText("Wallet connected")).toBeVisible();

  await page.getByRole("button", { name: "Request terms" }).click();

  // Inject durable receipt
  await page.evaluate(
    ({ hash, resourceId }) => {
      window.sessionStorage.setItem(
        `lumenbazaar:payment-recovery:${resourceId}`,
        JSON.stringify({
          correlationId: "corr_release",
          network: "stellar:testnet",
          paymentAttemptId: "attempt_release",
          receiptId: "receipt_release",
          resourceId,
          stage: "submitted",
          transactionHash: hash,
          updatedAt: "2026-10-07T17:00:00.000Z"
        })
      );
    },
    { hash: transactionHash, resourceId: "resource_release" }
  );

  await page.reload();
  await expect(page.getByText("Payment settled with a durable receipt.")).toBeVisible();

  // Navigate to receipt detail view if available
  const receiptLink = page.getByRole("link", { name: "receipt_release" });
  if (await receiptLink.isVisible()) {
    await receiptLink.click();
    await page.waitForLoadState("networkidle");
    await captureScreenshot(page, `receipt-detail-${variant}.png`);
  }
});

test("error state - challenge missing handler", async ({ page, browserName }) => {
  const variant = browserName === "chromium" ? "desktop" : "mobile";
  await installPaidResourceRoute(page, "missing-header");
  await page.goto("/resources/resource_release");

  const requestTerms = page.getByRole("button", { name: "Request terms" });
  await requestTerms.click();

  const alert = page.getByRole("alert").filter({ hasText: "CHALLENGE_MISSING" });
  await expect(alert).toBeVisible();
  await page.waitForLoadState("networkidle");

  await captureScreenshot(page, `error-challenge-missing-${variant}.png`);
});

async function installPaidResourceRoute(page: Page, mode: "challenge" | "missing-header") {
  await page.route("http://127.0.0.1:8080/paid**", async (route) => {
    if (route.request().method() === "OPTIONS") {
      return route.fulfill({ headers: corsHeaders(), status: 204 });
    }
    if (mode === "missing-header") {
      return route.fulfill({ headers: corsHeaders(), status: 402 });
    }
    return route.fulfill({
      headers: {
        ...corsHeaders(),
        "Access-Control-Expose-Headers": "PAYMENT-REQUIRED,PAYMENT-RESPONSE",
        "PAYMENT-REQUIRED": encodePaymentRequiredHeader(challenge() as PaymentRequired)
      },
      status: 402
    });
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Headers": "Accept,Content-Type,x-request-id,PAYMENT-SIGNATURE",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Origin": "*"
  };
}

async function installFreighterProtocolStub(page: Page) {
  await page.addInitScript(
    ({ address, passphrase }) => {
      Object.defineProperty(window, "freighter", { configurable: true, value: true });
      window.addEventListener("message", (event) => {
        const request = event.data as { messageId?: number; source?: string; type?: string };
        if (request.source !== "FREIGHTER_EXTERNAL_MSG_REQUEST") return;

        const response: Record<string, unknown> = {
          messagedId: request.messageId,
          source: "FREIGHTER_EXTERNAL_MSG_RESPONSE"
        };
        if (request.type === "REQUEST_ALLOWED_STATUS") response.isAllowed = true;
        if (request.type === "REQUEST_PUBLIC_KEY" || request.type === "REQUEST_ACCESS") {
          response.publicKey = address;
        }
        if (request.type === "REQUEST_NETWORK") {
          response.networkDetails = {
            network: "TESTNET",
            networkPassphrase: passphrase
          };
        }
        window.postMessage(response, window.location.origin);
      });
    },
    { address: payer, passphrase: "Test SDF Network ; September 2015" }
  );
}

function challenge() {
  return {
    accepts: [
      {
        amount: "500000",
        asset: assetContract,
        extra: { areFeesSponsored: true, assetCode: "USDC", assetIssuer: issuer },
        maxTimeoutSeconds: 300,
        network: "stellar:testnet",
        payTo: payer,
        scheme: "exact"
      }
    ],
    resource: {
      description: "Paid release evidence",
      mimeType: "application/json",
      url: resourceUrl
    },
    x402Version: 2
  };
}

async function captureScreenshot(page: Page, filename: string) {
  // Redact sensitive data from DOM before screenshot
  await redactSensitiveDataInDOM(page);

  const fullPath = path.join(screenshotsDir, filename);
  await page.screenshot({ path: fullPath, fullPage: true });
}
