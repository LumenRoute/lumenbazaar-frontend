/**
 * Accessibility scanning spec for all primary routes.
 * Runs automated WCAG 2.x Level A & AA checks using axe-core.
 *
 * Coverage:
 * - All primary routes from PRIMARY_ROUTES fixture
 * - Both desktop and mobile viewports (from playwright.config.ts projects)
 * - Shared assertions: landmarks, headings, focus, live regions
 * - Known exceptions with owner, reason, and expiry dates
 *
 * Failures:
 * - Test fails on axe violations (after applying exceptions)
 * - Test fails on expired or stale exceptions
 * - Test fails if exception has no owner or expiry date
 *
 * Note: Automated scans catch common issues (landmarks, contrast, labels, focus).
 * Manual accessibility review with assistive technologies is still required for full WCAG conformance.
 */

import { expect, test } from "@playwright/test";
import { injectAxe, checkA11y, getViolations } from "axe-playwright";
import { PRIMARY_ROUTES, EXCLUDED_ROUTES } from "../fixtures/routes";
import { runSharedAssertions, getPageContext } from "../fixtures/accessibility";
import { A11Y_EXCEPTIONS, getExceptionsForRoute, validateExceptions } from "../fixtures/a11y-exceptions";

// Validate exceptions framework on test run
test.beforeAll(() => {
  const validation = validateExceptions();
  if (!validation.valid) {
    console.error("❌ Exception validation failed:");
    validation.errors.forEach((err) => console.error(`   - ${err}`));
    throw new Error("A11y exceptions are malformed");
  }
  console.log("✅ Exception framework validated");
});

test.describe("Accessibility - Shared Assertions", () => {
  /**
   * Test each primary route for consistent accessibility patterns.
   * Runs under both desktop and mobile projects automatically.
   */
  for (const route of PRIMARY_ROUTES) {
    test(`${route.name} (${route.path})`, async ({ page }) => {
      // Skip if this route is excluded for this platform
      if (route.skip) {
        test.skip(true, `Skipped: ${route.skip.reason} (owner: ${route.skip.owner})`);
      }

      try {
        // Navigate to route
        await page.goto(route.path);

        // Wait for page to stabilize
        await page.waitForLoadState("networkidle");

        // Log context for debugging
        const context = await getPageContext(page);
        console.log(`Testing: ${context}`);

        // Run shared assertions
        await runSharedAssertions(page);
      } catch (error) {
        console.error(`Failed on route: ${route.path}`);
        throw error;
      }
    });
  }
});

test.describe("Accessibility - Axe Scanning", () => {
  /**
   * Run axe-core scan on each primary route.
   * Applies known exceptions; fails if violations remain.
   */
  for (const route of PRIMARY_ROUTES) {
    test(`Axe scan: ${route.name} (${route.path})`, async ({ page }) => {
      // Skip if excluded
      if (route.skip) {
        test.skip(true, `Skipped: ${route.skip.reason} (owner: ${route.skip.owner})`);
      }

      try {
        // Navigate to route
        await page.goto(route.path);

        // Wait for page to stabilize
        await page.waitForLoadState("networkidle");

        // Inject axe into page
        await injectAxe(page);

        // Run axe check (will throw if violations found)
        const results = await page.evaluate(() => {
          return new Promise((resolve) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).axe.run((results: any) => {
              resolve(results);
            });
          });
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const violations = (results as any).violations || [];

        // Get exceptions for this route
        const exceptions = getExceptionsForRoute(route.path);

        // Filter out exceptions
        let filteredViolations = violations;
        if (exceptions.length > 0) {
          filteredViolations = violations.filter((v: any) => {
            return !exceptions.some((exc) => exc.ruleId === v.id);
          });

          console.log(
            `Applied ${exceptions.length} exception(s); ${violations.length - filteredViolations.length} violation(s) suppressed`
          );
        }

        // Check if any violations remain
        if (filteredViolations.length > 0) {
          const violationDetails = filteredViolations
            .map(
              (v: any) =>
                `\n  Rule: ${v.id}\n  Impact: ${v.impact}\n  Nodes: ${v.nodes.length}\n  Description: ${v.description}`
            )
            .join("\n");

          throw new Error(`Accessibility violations found on ${route.path}:${violationDetails}`);
        }

        console.log(`✅ ${route.path}: No violations`);

        // Verify no stale exceptions (exception added but no violation found)
        if (exceptions.length > 0) {
          for (const exc of exceptions) {
            const violationExists = violations.some((v: any) => v.id === exc.ruleId);
            if (!violationExists) {
              throw new Error(
                `Stale exception: rule "${exc.ruleId}" on ${route.path} does not match any violation. Remove this exception.`
              );
            }
          }
        }
      } catch (error) {
        console.error(`Axe scan failed on route: ${route.path}`);
        throw error;
      }
    });
  }
});

test.describe("Route Coverage Guard", () => {
  /**
   * Verify that all routes in src/app are accounted for in PRIMARY_ROUTES
   * or explicitly excluded with a reason, owner, and expiry date.
   *
   * This prevents routes from being accidentally unmaintained.
   */
  test("all routes are covered or explicitly excluded", async ({ page }) => {
    // Navigate to app to check page structure
    await page.goto("/");

    // Check that navigation includes all routes from PRIMARY_ROUTES
    // This is a smoke test; full discovery would require file system analysis

    const navLinks = await page.locator("nav a, [role='navigation'] a").all();
    const navHrefs = await Promise.all(navLinks.map((link) => link.getAttribute("href")));

    console.log(`Found ${navLinks.length} navigation links`);

    // Every href in nav should be in PRIMARY_ROUTES or EXCLUDED_ROUTES
    for (const href of navHrefs) {
      if (!href || href === "#") continue; // Skip anchors

      const isInPrimary = PRIMARY_ROUTES.some((r) => r.path === href);
      const isExcluded = EXCLUDED_ROUTES.some((r) => {
        // Simple glob matching: exact match or pattern
        if (r.pattern === href) return true;
        if (r.pattern.includes("*")) {
          // Basic glob support
          const regex = new RegExp(
            `^${r.pattern.replace(/\*/g, ".*").replace(/\?/g, ".")}$`
          );
          return regex.test(href);
        }
        return false;
      });

      expect(
        isInPrimary || isExcluded,
        `Route ${href} is not in PRIMARY_ROUTES or EXCLUDED_ROUTES. Add it to one of these lists.`
      ).toBe(true);
    }
  });
});
