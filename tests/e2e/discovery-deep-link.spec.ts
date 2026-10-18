import { expect, test } from "@playwright/test";

const deepLink =
  "/explore?network=stellar%3Atestnet&sort=price-desc&sellerVerification=verified&maxPrice=1";

test("copied discovery deep links restore filters and survive history navigation", async ({
  page
}) => {
  await page.goto(deepLink);

  await expect(page.getByLabel("Network")).toHaveValue("stellar:testnet");
  await expect(page.getByLabel("Sort resources")).toHaveValue("price-desc");
  await expect(page.getByLabel("Seller verification")).toHaveValue("verified");
  await expect(page.getByLabel("Maximum price")).toHaveValue("1");
  await expect(page.getByText("Paid Weather API")).toBeVisible();

  await page.getByLabel("Resource type").selectOption("http");
  await expect(page).toHaveURL(/type=http/);
  await expect(page.getByText("Paid Weather API")).toBeVisible();

  await page.goBack();
  await expect(page.getByLabel("Resource type")).toHaveValue("");
  await expect(page.getByLabel("Network")).toHaveValue("stellar:testnet");
  await expect(page.getByText("Paid Weather API")).toBeVisible();

  await page.goForward();
  await expect(page.getByLabel("Resource type")).toHaveValue("http");
});

test("selected resources produce a shareable comparison link", async ({ page }) => {
  await page.goto("/explore");

  const checkboxes = page.getByRole("checkbox");
  await expect(checkboxes).toHaveCount(2);

  await checkboxes.nth(0).check();
  await checkboxes.nth(1).check();

  await page.getByRole("link", { name: "Compare selected" }).click();

  await expect(page.getByRole("heading", { name: "Compare resources" })).toBeVisible();

  if (test.info().project.name === "mobile") {
    const mobileCards = page.getByTestId("comparison-mobile");
    await expect(mobileCards).toBeVisible();
    await expect(mobileCards.locator("dt", { hasText: "Asset contract" }).first()).toBeVisible();
    return;
  }

  const table = page.getByRole("table", { name: "Paid resource comparison" });
  await expect(table).toBeVisible();
  await expect(table.getByRole("rowheader", { name: /Asset contract/ })).toBeVisible();
});
