import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";

/**
 * Enhanced hydration warning detection setup
 * Ensures React hydration mismatches are properly captured during tests
 */

const originalWarn = console.warn;
const originalError = console.error;
let capturedWarnings: string[] = [];
let capturedErrors: string[] = [];

beforeEach(() => {
  capturedWarnings = [];
  capturedErrors = [];
});

afterEach(() => {
  // Optional: Log any hydration-related warnings/errors that occurred
  const allMessages = [...capturedWarnings, ...capturedErrors];
  const hydrationIssues = allMessages.filter((msg) =>
    /hydration|mismatch|expected|server|client/i.test(msg)
  );
  if (hydrationIssues.length > 0) {
    console.log("[Hydration Check]", hydrationIssues);
  }
});

// Wrap console methods to capture all warnings and errors
console.warn = vi.fn((...args) => {
  capturedWarnings.push(args.map((arg) => String(arg)).join(" "));
  originalWarn(...args);
});

console.error = vi.fn((...args) => {
  capturedErrors.push(args.map((arg) => String(arg)).join(" "));
  originalError(...args);
});
