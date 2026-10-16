/**
 * Unit tests for route coverage.
 * Verifies that PRIMARY_ROUTES is properly maintained and complete.
 */

import { describe, it, expect } from "vitest";
import { PRIMARY_ROUTES, EXCLUDED_ROUTES } from "../../tests/fixtures/routes";

describe("Route Coverage", () => {
  describe("PRIMARY_ROUTES", () => {
    it("should have routes for all primary sections", () => {
      // Verify we have routes for each primary area
      const paths = PRIMARY_ROUTES.map((r) => r.path);

      // Navigation & Discovery
      expect(paths).toContain("/");
      expect(paths).toContain("/explore");

      // Seller
      expect(paths.some((p) => p.startsWith("/seller"))).toBe(true);

      // Operators
      expect(paths.some((p) => p.startsWith("/operators"))).toBe(true);

      // Settings
      expect(paths).toContain("/settings");

      // Docs
      expect(paths).toContain("/docs");

      // Payment & Transactions
      expect(paths).toContain("/playground");
      expect(paths).toContain("/transactions");
      expect(paths.some((p) => p.startsWith("/receipts"))).toBe(true);
    });

    it("should have unique paths", () => {
      const paths = PRIMARY_ROUTES.map((r) => r.path);
      const uniquePaths = new Set(paths);
      expect(uniquePaths.size).toBe(paths.length);
    });

    it("should have descriptive names for each route", () => {
      for (const route of PRIMARY_ROUTES) {
        expect(route.name.length).toBeGreaterThan(0);
        expect(route.name).not.toBe("undefined");
        expect(route.name).not.toBe("null");
      }
    });

    it("should have valid paths (start with /)", () => {
      for (const route of PRIMARY_ROUTES) {
        expect(route.path).toMatch(/^\//);
      }
    });

    it("should not have trailing slashes (except root /)", () => {
      for (const route of PRIMARY_ROUTES) {
        if (route.path !== "/") {
          expect(route.path).not.toMatch(/\/$/);
        }
      }
    });

    it("should have at least 10 primary routes", () => {
      // Reasonable minimum coverage
      expect(PRIMARY_ROUTES.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe("EXCLUDED_ROUTES", () => {
    it("should have valid exclusions if any exist", () => {
      for (const exclusion of EXCLUDED_ROUTES) {
        expect(exclusion.pattern).toBeDefined();
        expect(exclusion.reason).toBeDefined();
        expect(exclusion.owner).toBeDefined();
        expect(exclusion.expiry).toBeDefined();

        // Expiry should be ISO 8601 format
        expect(exclusion.expiry).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });

    it("should not exclude non-expired routes", () => {
      const today = new Date().toISOString().split("T")[0];

      for (const exclusion of EXCLUDED_ROUTES) {
        expect(
          exclusion.expiry > today,
          `Exclusion ${exclusion.pattern} is expired (${exclusion.expiry} <= ${today})`
        ).toBe(true);
      }
    });
  });

  describe("Route-Exclusion interaction", () => {
    it("should not have overlapping routes and exclusions", () => {
      // A route shouldn't be both in PRIMARY_ROUTES and EXCLUDED_ROUTES
      const primaryPaths = PRIMARY_ROUTES.map((r) => r.path);

      for (const exclusion of EXCLUDED_ROUTES) {
        // Simple check: exact match
        expect(
          !primaryPaths.includes(exclusion.pattern),
          `Route ${exclusion.pattern} is both primary and excluded`
        ).toBe(true);
      }
    });

    it("should cover typical web app routes", () => {
      const routeNames = PRIMARY_ROUTES.map((r) => r.name.toLowerCase());
      const hasNavigationOrHome = routeNames.some((n) =>
        /dashboard|home|explore|navigation/.test(n)
      );
      const hasSettings = routeNames.some((n) => /settings|account|profile/.test(n));

      expect(hasNavigationOrHome).toBe(true);
      expect(hasSettings).toBe(true);
    });
  });
});
