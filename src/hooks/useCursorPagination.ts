"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { z } from "zod";

/**
 * Cursor pagination error types
 */
export type PaginationErrorCode =
  | "STALE_CURSOR"
  | "MALFORMED_CURSOR"
  | "NETWORK_ERROR"
  | "INVALID_RESPONSE";

export interface PaginationError {
  code: PaginationErrorCode;
  message: string;
}

/**
 * Paginated response from backend
 */
export interface PaginatedResponse<T> {
  items: T[];
  nextCursor?: string;
  previousCursor?: string;
}

/**
 * Options for the cursor pagination hook
 */
export interface UseCursorPaginationOptions<T> {
  /**
   * Query function that fetches a page of items.
   * @param cursor Optional cursor for current page
   * @param direction Navigation direction ('forward' for next, 'backward' for previous)
   * @returns Paginated response with items and cursors
   */
  queryFn: (cursor?: string, direction?: "forward" | "backward") => Promise<PaginatedResponse<T>>;

  /**
   * Extract stable identifier from item (used for deduplication)
   */
  getKey: (item: T) => string;

  /**
   * Optional URL search params for tracking pagination state.
   * If not provided, uses Next.js useSearchParams hook internally.
   */
  urlSearchParams?: URLSearchParams;

  /**
   * Optional callback before navigation
   */
  onBeforeNavigation?: (direction: "forward" | "backward") => void;

  /**
   * Page size (default: 50). Used for deduplication tracking.
   */
  pageSize?: number;

  /**
   * Optional callback to update URL params
   */
  onUpdateUrl?: (params: URLSearchParams) => void;
}

/**
 * Result of cursor pagination hook
 */
export interface UseCursorPaginationResult<T> {
  // Current page rows (deduplicated)
  rows: T[];

  // Loading state
  isLoading: boolean;

  // Error state (if any)
  error?: PaginationError;

  // Pagination state
  hasNextPage: boolean;
  hasPreviousPage: boolean;

  // Navigation functions
  nextPage: () => void;
  previousPage: () => void;
  resetPagination: () => void;
}

/**
 * Schema for cursor validation
 */
const cursorSchema = z.string().max(1024).optional();
const directionSchema = z.enum(["forward", "backward"]).optional();

/**
 * Validates cursor format
 */
function isValidCursor(value: unknown): value is string | undefined {
  const result = cursorSchema.safeParse(value);
  return result.success;
}

/**
 * Deduplicates items by key while preserving backend order
 */
function deduplicate<T>(newItems: T[], getKey: (item: T) => string, existingItems?: T[]): T[] {
  const seen = new Set<string>();

  // Add existing keys to the set
  if (existingItems) {
    for (const item of existingItems) {
      seen.add(getKey(item));
    }
  }

  // Filter out duplicates from new items
  const deduplicated: T[] = [];
  for (const item of newItems) {
    const key = getKey(item);
    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(item);
    }
  }

  return deduplicated;
}

/**
 * Hook for managing cursor-based pagination with URL persistence
 *
 * Features:
 * - Cursor state persisted in URL search params
 * - Automatic deduplication of rows by stable key
 * - Graceful handling of stale/malformed cursors
 * - Abort controller for race condition handling
 * - Non-destructive loading states
 *
 * @example
 * ```tsx
 * const { rows, isLoading, hasNextPage, nextPage, previousPage } = useCursorPagination({
 *   queryFn: (cursor, direction) => fetchPayments(cursor, direction),
 *   getKey: (payment) => payment.id,
 * });
 * ```
 */
export function useCursorPagination<T>({
  queryFn,
  getKey,
  urlSearchParams,
  onBeforeNavigation,
  pageSize = 50,
  onUpdateUrl
}: UseCursorPaginationOptions<T>): UseCursorPaginationResult<T> {
  const searchParams = useSearchParams();

  // State for current page
  const [rows, setRows] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<PaginationError | undefined>();

  // Track pagination metadata
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [previousCursor, setPreviousCursor] = useState<string | undefined>();

  // Abort controller for race condition handling
  const abortControllerRef = useRef<AbortController | null>(null);

  // Read cursor from URL
  const currentCursor = urlSearchParams?.get("cursor") ?? searchParams.get("cursor") ?? undefined;
  const currentDirection = (urlSearchParams?.get("direction") ??
    searchParams.get("direction")) as "forward" | "backward" | undefined;

  /**
   * Update URL with new cursor and direction
   */
  const updateUrl = useCallback(
    (newCursor: string | undefined, direction: "forward" | "backward" | undefined) => {
      const params = new URLSearchParams(urlSearchParams ?? searchParams);

      if (newCursor) {
        params.set("cursor", newCursor);
      } else {
        params.delete("cursor");
      }

      if (direction) {
        params.set("direction", direction);
      } else {
        params.delete("direction");
      }

      if (onUpdateUrl) {
        onUpdateUrl(params);
      } else {
        // Update browser URL without reload
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState(null, "", newUrl);
      }
    },
    [searchParams, urlSearchParams, onUpdateUrl]
  );

  /**
   * Fetch page of data
   */
  const fetchPage = useCallback(
    async (cursor: string | undefined, direction: "forward" | "backward" | undefined) => {
      // Abort previous request if any
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        setIsLoading(true);
        setError(undefined);

        // Validate cursor format
        if (!isValidCursor(cursor)) {
          setError({
            code: "MALFORMED_CURSOR",
            message: "Invalid cursor format. Starting from the beginning."
          });
          setRows([]);
          setNextCursor(undefined);
          setPreviousCursor(undefined);
          return;
        }

        // Fetch data with timeout
        const timeoutId = setTimeout(() => controller.abort(), 30_000);

        try {
          const response = await queryFn(cursor, direction);

          if (controller.signal.aborted) {
            return;
          }

          clearTimeout(timeoutId);

          // Deduplicate and merge results
          const dedupedItems = deduplicate(response.items, getKey, rows);
          const allRows = [...rows, ...dedupedItems];

          setRows(allRows);
          setNextCursor(response.nextCursor);
          setPreviousCursor(response.previousCursor);
          setIsLoading(false);
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }

        // Detect stale cursor (backend returns 400 or empty)
        const isStale =
          err instanceof Error &&
          (err.message.includes("400") || err.message.includes("Invalid cursor"));

        setError({
          code: isStale ? "STALE_CURSOR" : "NETWORK_ERROR",
          message: isStale
            ? "Page is outdated. Starting from the beginning."
            : "Failed to load page. Please try again."
        });

        // On stale cursor, reset to first page
        if (isStale) {
          setRows([]);
          setNextCursor(undefined);
          setPreviousCursor(undefined);
        }

        setIsLoading(false);
      } finally {
        abortControllerRef.current = null;
      }
    },
    [queryFn, getKey, rows]
  );

  /**
   * Load initial page or current page on mount/cursor change
   */
  useEffect(() => {
    fetchPage(currentCursor, currentDirection);
  }, [currentCursor, currentDirection, fetchPage]);

  /**
   * Navigate to next page
   */
  const handleNextPage = useCallback(() => {
    if (!nextCursor) return;

    onBeforeNavigation?.("forward");
    updateUrl(nextCursor, "forward");

    // Reset current rows to avoid showing old data during transition
    setRows([]);
  }, [nextCursor, updateUrl, onBeforeNavigation]);

  /**
   * Navigate to previous page
   */
  const handlePreviousPage = useCallback(() => {
    if (!previousCursor) return;

    onBeforeNavigation?.("backward");
    updateUrl(previousCursor, "backward");

    // Reset current rows to avoid showing old data during transition
    setRows([]);
  }, [previousCursor, updateUrl, onBeforeNavigation]);

  /**
   * Reset to first page
   */
  const handleResetPagination = useCallback(() => {
    updateUrl(undefined, undefined);
    setRows([]);
    setNextCursor(undefined);
    setPreviousCursor(undefined);
    setError(undefined);
  }, [updateUrl]);

  return {
    rows,
    isLoading,
    error,
    hasNextPage: !!nextCursor,
    hasPreviousPage: !!previousCursor,
    nextPage: handleNextPage,
    previousPage: handlePreviousPage,
    resetPagination: handleResetPagination
  };
}
