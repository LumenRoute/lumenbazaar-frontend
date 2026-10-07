import { expect, test } from "@playwright/test";

const resourceId = process.env.LUMENBAZAAR_LIVE_RESOURCE_ID;
const externalGateConfigured =
  process.env.LUMENBAZAAR_LIVE_BASE_URL !== undefined &&
  process.env.FREIGHTER_EXTENSION_PATH !== undefined &&
  resourceId !== undefined;

test("fresh wallet completes the deployed reviewer payment path without network interception", async ({
  page
}) => {
  test.skip(
    !externalGateConfigured,
    "Set the live URL, resource ID, and Freighter extension path."
  );

  await page.goto(`/resources/${resourceId}`);
  await expect(page.getByRole("heading", { name: "Resource detail" })).toBeVisible();

  await page.getByRole("button", { name: "Connect Freighter" }).click();
  await expect(page.getByText("Wallet connected")).toBeVisible();

  await page.getByRole("button", { name: "Request terms" }).click();
  await expect(page.getByText("Validated x402 v2 exact")).toBeVisible();

  await page.getByRole("button", { name: "Authorize payment" }).click();
  await expect(page.getByText("Payment authorization ready")).toBeVisible();

  await page.getByRole("button", { name: "Submit paid request" }).click();
  await expect(page.getByText("Payment settled with a durable receipt.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Stellar transaction" })).toHaveAttribute(
    "href",
    /stellar\.expert\/explorer\/testnet\/tx\//
  );

  await page.reload();
  await expect(page.getByText("Payment settled with a durable receipt.")).toBeVisible();
});
