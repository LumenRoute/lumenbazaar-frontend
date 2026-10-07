import { encodePaymentRequiredHeader } from "@x402/core/http";
import type { PaymentRequired } from "@x402/core/types";
import { expect, test, type Page } from "@playwright/test";

const resourceUrl = "http://127.0.0.1:8080/paid?query=stellar";
const assetContract = "CB256KDRXDO2FYJN3YBYZE5KCU46WIIE67DRP5T7HI45DRH2GM6YOJFS";
const issuer = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const payer = "GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE";
const transactionHash = "a".repeat(64);

test.beforeEach(async ({ page }) => {
  await installFreighterProtocolStub(page);
});

test("reviewer can discover terms, connect a wallet, and recover durable evidence", async ({
  page
}) => {
  await installPaidResourceRoute(page, "challenge");
  await page.goto("/explore");

  await expect(page.getByText("Release-gated Stellar API")).toBeVisible();
  await page.getByRole("link", { name: "Inspect", exact: true }).click();

  await page.getByRole("button", { name: "Connect Freighter" }).click();
  await expect(page.getByText("Wallet connected")).toBeVisible();

  await page.getByRole("button", { name: "Request terms" }).click();
  await expect(page.getByText("Validated x402 v2 exact")).toBeVisible();
  await expect(page.getByText(assetContract, { exact: true })).toBeVisible();
  await expect(page.getByText(payer, { exact: true }).last()).toBeVisible();

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
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.sessionStorage.getItem("lumenbazaar:payment-recovery:resource_release")
      )
    )
    .not.toBeNull();
  await page.reload();

  await expect(page.getByText("Payment settled with a durable receipt.")).toBeVisible();
  await expect(page.getByText("receipt_release", { exact: true })).toBeVisible();
  await expect(page.locator('[aria-live="polite"]')).toContainText("Confirmed");
  await expect(page.getByRole("link", { name: "Stellar transaction" })).toHaveAttribute(
    "href",
    new RegExp(`${transactionHash}$`)
  );
  expect(
    await page.locator("body").evaluate((body) => body.scrollWidth <= body.clientWidth + 1)
  ).toBe(true);
});

test("challenge failures are keyboard reachable and announced as errors", async ({ page }) => {
  await installPaidResourceRoute(page, "missing-header");
  await page.goto("/resources/resource_release");

  const requestTerms = page.getByRole("button", { name: "Request terms" });
  await requestTerms.focus();
  await expect(requestTerms).toBeFocused();
  await page.keyboard.press("Enter");

  const alert = page.getByRole("alert").filter({ hasText: "CHALLENGE_MISSING" });
  await expect(alert).toBeVisible();
  await expect(alert).toContainText("CHALLENGE_MISSING");
  expect(await alert.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
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
