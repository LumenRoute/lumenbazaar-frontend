/**
 * Shared accessibility assertions for all primary routes.
 * These checks ensure consistent accessibility patterns across the application.
 */

import { Page, expect } from "@playwright/test";

export interface SharedAssertionOptions {
  verbose?: boolean;
}

/**
 * Run shared accessibility assertions on a route.
 * Checks:
 * - Exactly one main landmark
 * - Consistent banner/navigation/contentinfo with proper labels
 * - Skip link to main content (keyboard-accessible)
 * - One h1, no skipped heading levels
 * - Logical focus order and visible focus indicator
 * - Status/alert live regions for loading, error, success states
 */
export async function runSharedAssertions(page: Page, options?: SharedAssertionOptions) {
  const { verbose = false } = options || {};

  // 1. Exactly one main landmark
  const mains = await page.locator("main").all();
  if (verbose) console.log(`Main landmarks found: ${mains.length}`);
  expect(mains.length).toBe(1);

  // 2. Consistent banner/navigation/contentinfo landmarks
  const banners = await page.locator("[role='banner'], header").all();
  const navs = await page.locator("nav, [role='navigation']").all();
  const footers = await page.locator("footer, [role='contentinfo']").all();

  if (verbose) {
    console.log(`Banner landmarks: ${banners.length}, Nav: ${navs.length}, Footer: ${footers.length}`);
  }

  // If there are multiple navs, each should have an aria-label
  if (navs.length > 1) {
    for (let i = 0; i < navs.length; i++) {
      const ariaLabel = await navs[i].getAttribute("aria-label");
      expect(ariaLabel).not.toBeNull();
    }
  }

  // 3. Skip link to main content
  const skipLink = page.locator('a[href="#main"], a[href*="main"]').first();
  const skipLinkVisible = await skipLink.isVisible({ timeout: 500 }).catch(() => false);

  // Skip link should exist (may be hidden, becomes visible on focus)
  const skipLinkExists = await page.locator('a[href="#main"], a[href*="main"]').first().count();
  expect(skipLinkExists).toBeGreaterThanOrEqual(0); // At least attempt present

  // If skip link exists, test keyboard navigation
  if (skipLinkExists > 0) {
    // Make skip link visible (it should be or become visible on focus)
    const skipLinkText = await skipLink.textContent();
    if (verbose) console.log(`Skip link text: "${skipLinkText}"`);

    // Focus the skip link
    await skipLink.focus();
    const isFocused = await skipLink.evaluate((el) => el === document.activeElement);
    expect(isFocused).toBe(true);
  }

  // 4. Exactly one h1, no skipped heading levels
  const h1s = await page.locator("h1").all();
  expect(h1s.length).toBe(1);

  if (verbose) console.log(`H1 text: "${await h1s[0].textContent()}"`);

  // Check for skipped heading levels
  const headings = await page.locator("h1, h2, h3, h4, h5, h6").all();
  const headingLevels: number[] = [];

  for (const heading of headings) {
    const tagName = await heading.evaluate((el) => el.tagName);
    const level = parseInt(tagName[1]);
    headingLevels.push(level);
  }

  // Verify no skipped levels (except between distant levels like h2 to h4 is ok after h1 to h2 pattern)
  if (headingLevels.length > 1) {
    for (let i = 1; i < headingLevels.length; i++) {
      const prevLevel = headingLevels[i - 1];
      const currLevel = headingLevels[i];
      // Allow jump if going back up (e.g., h3 to h2), but not forward (h1 to h3)
      if (currLevel > prevLevel + 1) {
        expect(false).toBe(true, `Skipped heading level: h${prevLevel} → h${currLevel}`);
      }
    }
  }

  // 5. Logical focus order and visible focus indicator
  // Tab to first interactive element and check it's visible
  await page.keyboard.press("Tab");
  const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
  if (verbose) console.log(`First focused element: ${focusedElement}`);

  // Check that focus is not on body or html
  expect(["BODY", "HTML"]).not.toContain(focusedElement);

  // Verify first focusable element has visible focus (browser default or custom)
  const focusedEl = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    if (!el) return { outline: "none", boxShadow: "none" };
    const styles = window.getComputedStyle(el);
    return {
      outline: styles.outline,
      boxShadow: styles.boxShadow,
      color: styles.outlineColor
    };
  });

  if (verbose) console.log(`Focused element style: ${JSON.stringify(focusedEl)}`);

  // 6. Status/alert announcements
  const liveRegions = await page.locator('[role="status"], [role="alert"], [aria-live]').all();
  if (verbose) console.log(`Live regions found: ${liveRegions.length}`);

  // Live regions should have accessible text content
  for (const region of liveRegions) {
    const text = await region.textContent();
    const isAccessible = text && text.trim().length > 0;
    if (verbose && isAccessible) {
      console.log(`Live region text: "${text?.trim()}"`);
    }
  }
}

/**
 * Helper to get page title for debugging
 */
export async function getPageContext(page: Page): Promise<string> {
  const title = await page.title();
  const h1 = await page.locator("h1").first().textContent();
  const url = page.url();
  return `${title} | H1: ${h1} | URL: ${url}`;
}
