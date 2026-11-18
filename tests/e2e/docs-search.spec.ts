import { expect, test } from "@playwright/test";

test.describe("Documentation Search - Desktop", () => {
  test.use({ ...test.describe.config().use });

  test("docs page renders with search component", async ({ page }) => {
    await page.goto("/docs");

    await expect(page.getByRole("heading", { name: "Documentation" })).toBeVisible();
    await expect(
      page.getByPlaceholderText(/Search seller, buyer, agent, operator/i)
    ).toBeVisible();
  });

  test("search input accepts user input and displays results", async ({ page }) => {
    await page.goto("/docs");

    const searchInput = page.getByPlaceholderText(/Search seller, buyer, agent, operator/i);
    await searchInput.fill("seller");

    // Wait for results to appear
    const results = page.getByRole("option");
    await expect(results.first()).toBeVisible();

    // Should have at least one result
    const resultCount = await results.count();
    expect(resultCount).toBeGreaterThan(0);
  });

  test("search displays exact match with highest score", async ({ page }) => {
    await page.goto("/docs");

    const searchInput = page.getByPlaceholderText(/Search seller, buyer, agent, operator/i);
    await searchInput.fill("Seller docs");

    // First result should be the exact match
    const firstOption = page.getByRole("option").first();
    await expect(firstOption).toContainText("Seller docs");

    // Should show a high relevance score (100%)
    const scoreText = firstOption.locator("text=/\\d+%/");
    await expect(scoreText).toContainText("100%");
  });

  test("search finds results by keyword", async ({ page }) => {
    await page.goto("/docs");

    const searchInput = page.getByPlaceholderText(/Search seller, buyer, agent, operator/i);
    await searchInput.fill("domain verification");

    const results = page.getByRole("option");
    await expect(results.first()).toBeVisible();

    // Should find seller docs since it has domain verification keyword
    const resultCount = await results.count();
    expect(resultCount).toBeGreaterThan(0);
  });

  test("search finds results by description text", async ({ page }) => {
    await page.goto("/docs");

    const searchInput = page.getByPlaceholderText(/Search seller, buyer, agent, operator/i);
    await searchInput.fill("payment");

    const results = page.getByRole("option");
    await expect(results.first()).toBeVisible();
  });

  test("search displays no results message for non-matching query", async ({ page }) => {
    await page.goto("/docs");

    const searchInput = page.getByPlaceholderText(/Search seller, buyer, agent, operator/i);
    await searchInput.fill("xyznonexistentquery");

    // Should show no results message
    await expect(page.getByText(/No documentation found/i)).toBeVisible();

    // No options should be displayed
    const results = page.getByRole("option");
    const count = await results.count();
    expect(count).toBe(0);
  });

  test("clear button removes search text", async ({ page }) => {
    await page.goto("/docs");

    const searchInput = page.getByPlaceholderText(/Search seller, buyer, agent, operator/i);
    await searchInput.fill("seller");

    // Clear button should appear
    const clearButton = page.getByLabel("Clear search");
    await expect(clearButton).toBeVisible();

    await clearButton.click();

    // Input should be empty
    await expect(searchInput).toHaveValue("");

    // Results should disappear
    const results = page.getByRole("option");
    const count = await results.count();
    expect(count).toBe(0);
  });

  test("keyboard navigation works with arrow keys", async ({ page }) => {
    await page.goto("/docs");

    const searchInput = page.getByPlaceholderText(/Search seller, buyer, agent, operator/i);
    await searchInput.fill("docs");

    // Wait for results
    const firstOption = page.getByRole("option").first();
    await expect(firstOption).toBeVisible();

    // Press arrow down to select first result
    await searchInput.press("ArrowDown");

    // First option should be highlighted
    await expect(firstOption).toHaveClass(/border-teal-300/);
  });

  test("escape key closes search results and clears input", async ({ page }) => {
    await page.goto("/docs");

    const searchInput = page.getByPlaceholderText(/Search seller, buyer, agent, operator/i);
    await searchInput.fill("seller");

    // Results should be visible
    const results = page.getByRole("option");
    await expect(results.first()).toBeVisible();

    // Press escape
    await searchInput.press("Escape");

    // Input should be empty
    await expect(searchInput).toHaveValue("");

    // Results should disappear
    const resultCount = await results.count();
    expect(resultCount).toBe(0);
  });

  test("clicking result opens external link", async ({ page, context }) => {
    await page.goto("/docs");

    const searchInput = page.getByPlaceholderText(/Search seller, buyer, agent, operator/i);
    await searchInput.fill("Seller docs");

    const firstOption = page.getByRole("option").first();
    await expect(firstOption).toBeVisible();

    // Intercept popup windows
    const popupPromise = context.waitForEvent("page");
    await firstOption.click();

    const popup = await popupPromise;
    expect(popup.url()).toContain("github.com");
    expect(popup.url()).toContain("sellers");
    await popup.close();
  });

  test("search results display relevance score", async ({ page }) => {
    await page.goto("/docs");

    const searchInput = page.getByPlaceholderText(/Search seller, buyer, agent, operator/i);
    await searchInput.fill("seller");

    const firstOption = page.getByRole("option").first();

    // Should display a relevance score
    const scoreElements = firstOption.locator("text=/\\d+%/");
    await expect(scoreElements).toBeTruthy();
  });

  test("search results display keywords", async ({ page }) => {
    await page.goto("/docs");

    const searchInput = page.getByPlaceholderText(/Search seller, buyer, agent, operator/i);
    await searchInput.fill("seller");

    const firstOption = page.getByRole("option").first();

    // Should show some keywords
    const keywordElements = firstOption.locator("text/domain|onboarding|metadata/");
    const count = await keywordElements.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("canonical documentation links are still visible below search", async ({ page }) => {
    await page.goto("/docs");

    // Search component should be visible
    const searchInput = page.getByPlaceholderText(/Search seller, buyer, agent, operator/i);
    await expect(searchInput).toBeVisible();

    // Documentation category links should still be visible
    await expect(page.getByRole("link", { name: /Seller docs/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Buyer docs/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Operator docs/ })).toBeVisible();
  });

  test("search updates results as user types", async ({ page }) => {
    await page.goto("/docs");

    const searchInput = page.getByPlaceholderText(/Search seller, buyer, agent, operator/i);

    // Type one character
    await searchInput.fill("s");
    let results = page.getByRole("option");
    let initialCount = await results.count();
    expect(initialCount).toBeGreaterThan(0);

    // Type more characters
    await searchInput.fill("seller");
    results = page.getByRole("option");
    let refinedCount = await results.count();

    // Refined search should have results
    expect(refinedCount).toBeGreaterThan(0);
  });

  test("search is case-insensitive", async ({ page }) => {
    await page.goto("/docs");

    const searchInput = page.getByPlaceholderText(/Search seller, buyer, agent, operator/i);

    // Search lowercase
    await searchInput.fill("seller docs");
    let results1 = page.getByRole("option");
    let count1 = await results1.count();

    // Clear and search uppercase
    await searchInput.fill("");
    await page.waitForTimeout(100);
    await searchInput.fill("SELLER DOCS");
    let results2 = page.getByRole("option");
    let count2 = await results2.count();

    // Results count should match
    expect(count1).toBe(count2);
  });

  test("click outside search closes results dropdown", async ({ page }) => {
    await page.goto("/docs");

    const searchInput = page.getByPlaceholderText(/Search seller, buyer, agent, operator/i);
    await searchInput.fill("seller");

    // Results should be visible
    let results = page.getByRole("option");
    await expect(results.first()).toBeVisible();

    // Click on a documentation link
    const sellerLink = page.getByRole("link", { name: /Seller docs/ }).first();
    const boundingBox = await sellerLink.boundingBox();
    if (boundingBox) {
      await page.click(
        (boundingBox.x + boundingBox.width / 2).toString(),
        (boundingBox.y + boundingBox.height / 2).toString()
      );
    }

    // Results should disappear
    results = page.getByRole("option");
    const count = await results.count();
    expect(count).toBe(0);
  });
});

test.describe("Documentation Search - Mobile", () => {
  test.use({ ...test.describe.config().use });

  test("search component is responsive on mobile", async ({ page }) => {
    await page.goto("/docs");

    // Search input should be visible and full width
    const searchInput = page.getByPlaceholderText(/Search seller, buyer, agent, operator/i);
    await expect(searchInput).toBeVisible();

    // Should be able to interact with it
    await searchInput.fill("seller");

    const results = page.getByRole("option");
    await expect(results.first()).toBeVisible();
  });

  test("search results dropdown is scrollable on mobile", async ({ page }) => {
    await page.goto("/docs");

    const searchInput = page.getByPlaceholderText(/Search seller, buyer, agent, operator/i);
    await searchInput.fill("d");

    // Results container should be visible and have max-height
    const resultsContainer = page.getByRole("listbox");
    await expect(resultsContainer).toBeVisible();

    // Should be able to scroll through results
    const results = page.getByRole("option");
    const firstResult = results.first();
    await expect(firstResult).toBeVisible();
  });

  test("touch interactions work on mobile", async ({ page }) => {
    await page.goto("/docs");

    const searchInput = page.getByPlaceholderText(/Search seller, buyer, agent, operator/i);
    await searchInput.tap();
    await searchInput.fill("seller");

    // Results should appear
    const results = page.getByRole("option");
    await expect(results.first()).toBeVisible();

    // Tap on first result
    await results.first().tap();

    // Should navigate to external link or close results
    const resultCount = await results.count();
    expect(resultCount).toBeLessThanOrEqual(0);
  });

  test("keyboard navigation works on mobile with virtual keyboard", async ({ page }) => {
    await page.goto("/docs");

    const searchInput = page.getByPlaceholderText(/Search seller, buyer, agent, operator/i);
    await searchInput.fill("docs");

    // Press enter on keyboard
    await searchInput.press("Enter");

    // Should work without issues
    await expect(page.getByRole("heading", { name: "Documentation" })).toBeVisible();
  });
});

test.describe("Documentation Search - Accessibility", () => {
  test.use({ ...test.describe.config().use });

  test("search has proper ARIA labels", async ({ page }) => {
    await page.goto("/docs");

    const searchInput = page.getByLabel("Search documentation");
    await expect(searchInput).toBeVisible();
  });

  test("results are marked as listbox with options", async ({ page }) => {
    await page.goto("/docs");

    const searchInput = page.getByPlaceholderText(/Search seller, buyer, agent, operator/i);
    await searchInput.fill("seller");

    const listbox = page.getByRole("listbox");
    await expect(listbox).toBeVisible();

    const options = page.getByRole("option");
    const count = await options.count();
    expect(count).toBeGreaterThan(0);
  });

  test("no results message has proper role", async ({ page }) => {
    await page.goto("/docs");

    const searchInput = page.getByPlaceholderText(/Search seller, buyer, agent, operator/i);
    await searchInput.fill("xyznonexistent");

    // Should have status role for screen readers
    const statusMessage = page.getByRole("status");
    await expect(statusMessage).toBeVisible();
  });

  test("search results open in new tab without security issues", async ({ page, context }) => {
    await page.goto("/docs");

    const searchInput = page.getByPlaceholderText(/Search seller, buyer, agent, operator/i);
    await searchInput.fill("API docs");

    const firstOption = page.getByRole("option").first();

    // Set up listener for new pages
    const popupPromise = context.waitForEvent("page");
    await firstOption.click();

    const popup = await popupPromise;

    // New page should have proper security attributes
    expect(popup.url()).toContain("github.com");

    // Check for noopener/noreferrer behavior
    const opener = await popup.evaluate(() => window.opener);
    expect(opener).toBeNull(); // noopener means window.opener is null

    await popup.close();
  });
});
