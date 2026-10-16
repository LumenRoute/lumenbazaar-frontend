/**
 * Unit tests for the accessibility exceptions framework.
 * Validates:
 * - Exception expiry enforcement
 * - Stale exception detection
 * - Missing required fields
 * - Date format validation
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { A11Y_EXCEPTIONS, validateExceptions, getExceptionsForRoute } from "../../tests/fixtures/a11y-exceptions";

describe("A11y Exceptions Framework", () => {
  describe("validateExceptions", () => {
    it("should validate that no exceptions are expired", () => {
      const validation = validateExceptions();
      expect(validation.valid).toBe(true);

      for (const error of validation.errors) {
        expect(error).not.toContain("expired");
      }
    });

    it("should validate that all exceptions have required fields", () => {
      const validation = validateExceptions();

      // Check for missing field errors
      const missingFieldErrors = validation.errors.filter(
        (e) => e.includes("missing") || e.includes("invalid")
      );

      expect(missingFieldErrors).toHaveLength(0);
    });

    it("should validate date format is ISO 8601", () => {
      const validation = validateExceptions();

      const dateFormatErrors = validation.errors.filter((e) => e.includes("invalid date format"));
      expect(dateFormatErrors).toHaveLength(0);
    });

    it("should return descriptive errors for malformed exceptions", () => {
      const validation = validateExceptions();

      if (!validation.valid) {
        expect(validation.errors.length).toBeGreaterThan(0);
        expect(validation.errors[0]).toMatch(/Exception \d+:|ruleId|route|selector|reason|owner|expiryDate/);
      }
    });
  });

  describe("getExceptionsForRoute", () => {
    it("should return exceptions for a specific route", () => {
      const exceptions = getExceptionsForRoute("/playground");
      expect(Array.isArray(exceptions)).toBe(true);
    });

    it("should filter by exact route match", () => {
      const playgroundExceptions = getExceptionsForRoute("/playground");
      const settingsExceptions = getExceptionsForRoute("/settings");

      // Should not cross-contaminate
      for (const exc of playgroundExceptions) {
        expect(exc.route).toBe("/playground");
      }

      for (const exc of settingsExceptions) {
        expect(exc.route).toBe("/settings");
      }
    });

    it("should return empty array for routes with no exceptions", () => {
      // Most routes should have no exceptions
      const exceptions = getExceptionsForRoute("/nonexistent-route");
      expect(exceptions).toEqual([]);
    });
  });

  describe("Exception entries", () => {
    it("should have all required fields for each exception", () => {
      for (let i = 0; i < A11Y_EXCEPTIONS.length; i++) {
        const exc = A11Y_EXCEPTIONS[i];
        expect(exc.ruleId, `Exception ${i}: ruleId`).toBeDefined();
        expect(exc.route, `Exception ${i}: route`).toBeDefined();
        expect(exc.selector, `Exception ${i}: selector`).toBeDefined();
        expect(exc.reason, `Exception ${i}: reason`).toBeDefined();
        expect(exc.owner, `Exception ${i}: owner`).toBeDefined();
        expect(exc.expiryDate, `Exception ${i}: expiryDate`).toBeDefined();
      }
    });

    it("should have non-empty reason field", () => {
      for (let i = 0; i < A11Y_EXCEPTIONS.length; i++) {
        const exc = A11Y_EXCEPTIONS[i];
        expect(exc.reason.length, `Exception ${i}: reason must not be empty`).toBeGreaterThan(0);
      }
    });

    it("should have owner field", () => {
      for (let i = 0; i < A11Y_EXCEPTIONS.length; i++) {
        const exc = A11Y_EXCEPTIONS[i];
        expect(exc.owner.length, `Exception ${i}: owner must not be empty`).toBeGreaterThan(0);
        // Owner should look like a person/team identifier (e.g., @team, email, name)
        expect(exc.owner).toMatch(/@|[\w.+\-]+@[\w.-]+|[\w\s.]+/);
      }
    });

    it("should have expiryDate in ISO 8601 format (YYYY-MM-DD)", () => {
      for (let i = 0; i < A11Y_EXCEPTIONS.length; i++) {
        const exc = A11Y_EXCEPTIONS[i];
        expect(exc.expiryDate, `Exception ${i}: expiryDate format`).toMatch(/^\d{4}-\d{2}-\d{2}$/);

        // Verify it's a valid date
        const date = new Date(exc.expiryDate);
        expect(date.toISOString().split("T")[0]).toBe(exc.expiryDate);
      }
    });

    it("should have expiryDate in the future", () => {
      const today = new Date().toISOString().split("T")[0];

      for (let i = 0; i < A11Y_EXCEPTIONS.length; i++) {
        const exc = A11Y_EXCEPTIONS[i];
        expect(
          exc.expiryDate >= today,
          `Exception ${i}: expiryDate must be in the future (${exc.expiryDate} >= ${today})`
        ).toBe(true);
      }
    });
  });

  describe("Exception coverage", () => {
    it("should have at most a reasonable number of exceptions", () => {
      // This is a smell test: if too many exceptions, might indicate a systemic issue
      expect(A11Y_EXCEPTIONS.length).toBeLessThanOrEqual(20);
    });

    it("should have unique rule + route + selector combinations", () => {
      const seen = new Set<string>();

      for (const exc of A11Y_EXCEPTIONS) {
        const key = `${exc.ruleId}:${exc.route}:${exc.selector}`;
        expect(
          !seen.has(key),
          `Duplicate exception: ${key}. Each exception must have a unique rule + route + selector.`
        ).toBe(true);
        seen.add(key);
      }
    });
  });
});
