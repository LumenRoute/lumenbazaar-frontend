import { expect, test, type Page } from "@playwright/test";

// Synthetic demo-mode data only. Runs on the desktop and mobile projects.

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectVisibleFocus(page: Page) {
  const indicator = await page.evaluate(() => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return null;
    const style = window.getComputedStyle(active);
    return {
      matchesFocusVisible: active.matches(":focus-visible"),
      outline: style.outlineStyle !== "none" && style.outlineWidth !== "0px",
      ring: style.boxShadow !== "none"
    };
  });

  expect(indicator).not.toBeNull();
  expect(indicator!.matchesFocusVisible).toBe(true);
  expect(indicator!.outline || indicator!.ring).toBe(true);
}

test("saves, reloads, applies, renames, and deletes a local discovery search", async ({ page }) => {
  await page.goto("/explore?network=stellar%3Atestnet&sellerVerification=verified&cursor=page_2");

  const saved = page.getByRole("region", { name: "Saved searches" });
  await expect(saved.getByText(/stay on this device and are never synced/)).toBeVisible();
  await expect(saved.getByText("No saved searches yet.")).toBeVisible();

  // The typed query is saved even though Search was not pressed.
  await page.getByLabel("Search resources").fill("weather");
  await saved.getByRole("button", { name: "Save current search" }).click();
  await saved.getByLabel("Search name").fill("Verified weather");
  await saved.getByRole("button", { name: "Save search" }).click();

  await expect(saved.getByRole("status")).toHaveText(
    'Search "Verified weather" saved on this device.'
  );
  await expect(saved.getByText("Verified weather", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const stored = await page.evaluate(() =>
    window.localStorage.getItem("lumenbazaar.frontend.discovery-searches.v1")
  );
  expect(stored).not.toContain("cursor");

  // Persists across a full reload in the same browser profile.
  await page.goto("/explore");
  await expect(saved.getByText("Verified weather", { exact: true })).toBeVisible();

  await saved.getByRole("button", { name: "Apply saved search Verified weather" }).click();
  await expect(page).toHaveURL(
    /\/explore\?q=weather&network=stellar%3Atestnet&sellerVerification=verified$/
  );
  await expect(page.getByLabel("Search resources")).toHaveValue("weather");
  await expect(page.getByLabel("Seller verification")).toHaveValue("verified");
  await expect(page.getByText("Cursor page")).toHaveCount(0);

  await saved.getByRole("button", { name: "Rename saved search Verified weather" }).click();
  await saved.getByLabel("New name for Verified weather").fill("Lagos weather");
  await saved.getByRole("button", { name: "Save name" }).click();
  await expect(saved.getByText("Lagos weather", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await saved.getByRole("button", { name: "Delete saved search Lagos weather" }).click();
  await saved.getByRole("button", { name: "Delete search" }).click();
  await expect(saved.getByText("No saved searches yet.")).toBeVisible();
});

test("clearing local data in Settings removes saved searches", async ({ page }) => {
  await page.goto("/explore?q=maps");

  const saved = page.getByRole("region", { name: "Saved searches" });
  await saved.getByRole("button", { name: "Save current search" }).click();
  await saved.getByLabel("Search name").fill("Maps");
  await saved.getByRole("button", { name: "Save search" }).click();
  await expect(saved.getByText("Maps", { exact: true })).toBeVisible();

  await page.goto("/settings");
  await expect(page.getByText("Saved searches on this device: 1")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "Clear local data" }).click();
  await page.getByRole("button", { name: "Yes, clear local data" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Local data cleared." })).toBeVisible();
  await expect(page.getByText("Saved searches on this device: 0")).toBeVisible();

  await page.goto("/explore");
  await expect(saved.getByText("No saved searches yet.")).toBeVisible();

  await page.reload();
  await expect(saved.getByText("No saved searches yet.")).toBeVisible();
});

test("saved searches work with the keyboard alone and show visible focus", async ({ page }) => {
  test.skip(test.info().project.name === "mobile", "Hardware keyboard flow is desktop-only.");

  await page.goto("/explore?q=weather");
  // The app shell moves focus to the page heading after each route loads.
  await expect(page.getByRole("heading", { level: 1, name: "Explore" })).toBeFocused();

  const saved = page.getByRole("region", { name: "Saved searches" });
  const saveButton = saved.getByRole("button", { name: "Save current search" });

  await saveButton.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(saveButton).toBeFocused();
  await expectVisibleFocus(page);

  await page.keyboard.press("Enter");
  const nameInput = saved.getByLabel("Search name");
  await expect(nameInput).toBeFocused();
  await nameInput.press("Control+a");
  await page.keyboard.type("Keyboard search");
  await page.keyboard.press("Enter");

  await expect(saved.getByText("Keyboard search", { exact: true })).toBeVisible();
  await expect(saveButton).toBeFocused();

  const rename = saved.getByRole("button", { name: "Rename saved search Keyboard search" });
  await rename.focus();
  await page.keyboard.press("Enter");
  await expect(saved.getByLabel("New name for Keyboard search")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(rename).toBeFocused();
  await expectVisibleFocus(page);
});
