import { expect, test } from "@playwright/test";

test("explore and resource detail flows render", async ({ page }) => {
  await page.goto("/explore");

  await expect(page.getByRole("heading", { name: "Explore" })).toBeVisible();
  await expect(page.getByLabel("Search resources")).toBeVisible();
  await expect(page.getByText("Paid Weather API")).toBeVisible();

  await page
    .getByRole("link", { name: /Inspect/ })
    .first()
    .click();

  await expect(page.getByRole("heading", { name: "Resource detail" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Payment terms" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Schemas" })).toBeVisible();
});

test("seller onboarding and playground flows render", async ({ page }) => {
  await page.goto("/seller/new-resource");

  await expect(page.getByRole("heading", { exact: true, name: "Resource Info" })).toBeVisible();
  await expect(page.getByLabel(/Resource name/)).toBeVisible();
  await expect(page.getByLabel(/Endpoint URL/)).toBeVisible();

  await page.goto("/playground");

  await expect(page.getByRole("heading", { name: "Payment playground" })).toBeVisible();
  await expect(page.getByLabel("Paid resource")).toBeVisible();
  await page.getByRole("button", { name: "402" }).click();
  await expect(page.getByText("PAYMENT-REQUIRED")).toBeVisible();
});

test("transactions and operator evidence flows render", async ({ page }) => {
  await page.goto("/transactions");

  await expect(page.getByRole("heading", { name: "Transactions" })).toBeVisible();
  await expect(page.getByLabel("Status")).toBeVisible();
  await expect(page.getByText("attempt_weather_001")).toBeVisible();

  await page.goto("/operators/health");
  await expect(page.getByRole("heading", { name: "Operator health" })).toBeVisible();
  await expect(page.getByRole("cell", { exact: true, name: "RPC" })).toBeVisible();
  await expect(page.getByRole("cell", { exact: true, name: "Horizon" })).toBeVisible();

  await page.goto("/operators/conformance");
  await expect(page.getByRole("heading", { name: "Conformance" })).toBeVisible();
  await expect(page.getByText("/supported", { exact: true })).toBeVisible();
  await expect(page.getByText("Capped upto sessions")).toBeVisible();
});
