/**
 * Hydration and Server-Rendering Test Utilities
 * 
 * These utilities help detect hydration mismatches and validate that components
 * properly handle server-rendering and client-side hydration.
 */

import { afterEach, beforeEach, vi } from "vitest";

/**
 * Console message interceptor for detecting hydration warnings.
 * React/Next.js emit specific warnings when hydration mismatches occur.
 */
export class HydrationWarningCapture {
  private originalWarn: typeof console.warn;
  private originalError: typeof console.error;
  private warnings: string[] = [];
  private errors: string[] = [];

  constructor() {
    this.originalWarn = console.warn;
    this.originalError = console.error;
  }

  /**
   * Start capturing console warnings and errors
   */
  start() {
    this.warnings = [];
    this.errors = [];

    console.warn = vi.fn((...args) => {
      this.warnings.push(args.map((arg) => String(arg)).join(" "));
      this.originalWarn(...args);
    });

    console.error = vi.fn((...args) => {
      this.errors.push(args.map((arg) => String(arg)).join(" "));
      this.originalError(...args);
    });
  }

  /**
   * Stop capturing and restore original console methods
   */
  stop() {
    console.warn = this.originalWarn;
    console.error = this.originalError;
  }

  /**
   * Get all captured warnings
   */
  getWarnings() {
    return this.warnings;
  }

  /**
   * Get all captured errors
   */
  getErrors() {
    return this.errors;
  }

  /**
   * Check if any hydration mismatch warnings were captured
   */
  hasHydrationWarnings() {
    const allMessages = [...this.warnings, ...this.errors];
    return allMessages.some((msg) =>
      /hydration|mismatch|expected|server|client/i.test(msg)
    );
  }

  /**
   * Get only hydration-related warnings
   */
  getHydrationWarnings() {
    const allMessages = [...this.warnings, ...this.errors];
    return allMessages.filter((msg) =>
      /hydration|mismatch|expected|server|client/i.test(msg)
    );
  }

  /**
   * Assert that no hydration warnings were captured
   */
  assertNoHydrationWarnings() {
    const hydrationWarnings = this.getHydrationWarnings();
    if (hydrationWarnings.length > 0) {
      throw new Error(
        `Hydration warnings detected:\n${hydrationWarnings.join("\n")}`
      );
    }
  }
}

/**
 * Create a hydration warning capture instance with automatic cleanup
 */
export function captureHydrationWarnings() {
  const capture = new HydrationWarningCapture();
  capture.start();
  
  return {
    capture,
    cleanup: () => capture.stop()
  };
}

/**
 * Mock localStorage for testing client-side storage access patterns
 */
export class MockStorage implements Storage {
  private data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  key(index: number): string | null {
    const keys = Array.from(this.data.keys());
    return keys[index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  [key: string]: unknown;
}

/**
 * Setup hydration test environment:
 * - Captures console warnings/errors
 * - Returns utilities for assertions
 */
export function setupHydrationTest() {
  const { capture, cleanup } = captureHydrationWarnings();
  const mockStorage = new MockStorage();

  beforeEach(() => {
    // Ensure storage is cleared before each test
    mockStorage.clear();
  });

  afterEach(() => {
    cleanup();
    mockStorage.clear();
  });

  return {
    capture,
    mockStorage,
    assertNoHydrationWarnings: () => capture.assertNoHydrationWarnings(),
    getHydrationWarnings: () => capture.getHydrationWarnings()
  };
}

/**
 * Helper to verify that a component's initial state is consistent
 * between server-side and client-side rendering
 */
export function createServerClientStateComparison<T>(
  serverValue: T,
  clientValue: T,
  propertyName: string
): { match: boolean; message: string } {
  const match = JSON.stringify(serverValue) === JSON.stringify(clientValue);
  const message = match
    ? `✓ ${propertyName} state matches between server and client`
    : `✗ ${propertyName} state mismatch: server=${JSON.stringify(serverValue)}, client=${JSON.stringify(clientValue)}`;

  return { match, message };
}
