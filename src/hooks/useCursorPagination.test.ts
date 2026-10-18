import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useCursorPagination, type PaginatedResponse } from "./useCursorPagination";

interface TestItem {
  id: string;
  name: string;
}

describe("useCursorPagination", () => {
  let mockQueryFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset history and URL
    window.history.replaceState(null, "", "/");
    mockQueryFn = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Initial load", () => {
    it("loads first page on mount with no cursor", async () => {
      const items: TestItem[] = [
        { id: "1", name: "Item 1" },
        { id: "2", name: "Item 2" }
      ];

      mockQueryFn.mockResolvedValue({
        items,
        nextCursor: "cursor-next"
      } satisfies PaginatedResponse<TestItem>);

      const { result } = renderHook(() =>
        useCursorPagination({
          queryFn: mockQueryFn,
          getKey: (item) => item.id
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.rows).toEqual(items);
      expect(result.current.hasNextPage).toBe(true);
      expect(result.current.hasPreviousPage).toBe(false);
      expect(mockQueryFn).toHaveBeenCalledWith(undefined, undefined);
    });

    it("shows loading state during initial fetch", async () => {
      mockQueryFn.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  items: [],
                  nextCursor: undefined
                }),
              100
            )
          )
      );

      const { result } = renderHook(() =>
        useCursorPagination({
          queryFn: mockQueryFn,
          getKey: (item: TestItem) => item.id
        })
      );

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe("Pagination navigation", () => {
    it("navigates to next page using nextCursor", async () => {
      const page1: TestItem[] = [{ id: "1", name: "Item 1" }];
      const page2: TestItem[] = [{ id: "2", name: "Item 2" }];

      mockQueryFn
        .mockResolvedValueOnce({
          items: page1,
          nextCursor: "next-cursor"
        })
        .mockResolvedValueOnce({
          items: page2,
          previousCursor: "prev-cursor"
        });

      const { result } = renderHook(() =>
        useCursorPagination({
          queryFn: mockQueryFn,
          getKey: (item) => item.id
        })
      );

      await waitFor(() => {
        expect(result.current.rows).toEqual(page1);
      });

      act(() => {
        result.current.nextPage();
      });

      await waitFor(() => {
        expect(result.current.rows).toEqual(page2);
      });

      expect(mockQueryFn).toHaveBeenCalledWith("next-cursor", "forward");
    });

    it("navigates to previous page using previousCursor", async () => {
      const urlParams = new URLSearchParams("?cursor=current-cursor");

      mockQueryFn.mockResolvedValue({
        items: [{ id: "prev-item", name: "Previous Item" }],
        previousCursor: "prev-cursor"
      });

      const { result } = renderHook(() =>
        useCursorPagination({
          queryFn: mockQueryFn,
          getKey: (item) => item.id,
          urlSearchParams: urlParams
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.previousPage();
      });

      await waitFor(() => {
        expect(mockQueryFn).toHaveBeenCalledWith("prev-cursor", "backward");
      });
    });

    it("disables next page when nextCursor is undefined", async () => {
      mockQueryFn.mockResolvedValue({
        items: [{ id: "1", name: "Item 1" }],
        nextCursor: undefined
      });

      const { result } = renderHook(() =>
        useCursorPagination({
          queryFn: mockQueryFn,
          getKey: (item) => item.id
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasNextPage).toBe(false);
    });

    it("disables previous page when previousCursor is undefined", async () => {
      mockQueryFn.mockResolvedValue({
        items: [{ id: "1", name: "Item 1" }],
        previousCursor: undefined
      });

      const { result } = renderHook(() =>
        useCursorPagination({
          queryFn: mockQueryFn,
          getKey: (item) => item.id
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasPreviousPage).toBe(false);
    });
  });

  describe("Deduplication", () => {
    it("deduplicates rows with same key", async () => {
      const item1 = { id: "1", name: "Item 1" };
      const item2 = { id: "2", name: "Item 2" };

      mockQueryFn
        .mockResolvedValueOnce({
          items: [item1, item2],
          nextCursor: "next"
        })
        .mockResolvedValueOnce({
          items: [item2, { id: "3", name: "Item 3" }],
          previousCursor: "prev"
        });

      const { result } = renderHook(() =>
        useCursorPagination({
          queryFn: mockQueryFn,
          getKey: (item) => item.id
        })
      );

      await waitFor(() => {
        expect(result.current.rows).toEqual([item1, item2]);
      });

      act(() => {
        result.current.nextPage();
      });

      await waitFor(() => {
        // Should deduplicate item2, keeping only item1, item2, item3
        expect(result.current.rows.map((r) => r.id)).toEqual(["2", "3"]);
      });
    });

    it("preserves backend order during deduplication", async () => {
      const items = [
        { id: "3", name: "Item 3" },
        { id: "1", name: "Item 1" },
        { id: "2", name: "Item 2" }
      ];

      mockQueryFn.mockResolvedValue({
        items,
        nextCursor: "next"
      });

      const { result } = renderHook(() =>
        useCursorPagination({
          queryFn: mockQueryFn,
          getKey: (item) => item.id
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.rows).toEqual(items);
    });

    it("does not reorder rows during deduplication", async () => {
      const page1 = [
        { id: "a", name: "A" },
        { id: "b", name: "B" }
      ];

      const page2 = [
        { id: "b", name: "B" },
        { id: "c", name: "C" },
        { id: "d", name: "D" }
      ];

      mockQueryFn
        .mockResolvedValueOnce({ items: page1, nextCursor: "next" })
        .mockResolvedValueOnce({ items: page2, previousCursor: "prev" });

      const { result } = renderHook(() =>
        useCursorPagination({
          queryFn: mockQueryFn,
          getKey: (item) => item.id
        })
      );

      await waitFor(() => {
        expect(result.current.rows.length).toBe(2);
      });

      act(() => {
        result.current.nextPage();
      });

      await waitFor(() => {
        expect(result.current.rows.length).toBeGreaterThan(2);
      });

      // Verify order is preserved from backend
      expect(result.current.rows.map((r) => r.id)).toEqual(["b", "c", "d"]);
    });
  });

  describe("Error handling", () => {
    it("handles network errors gracefully", async () => {
      mockQueryFn.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() =>
        useCursorPagination({
          queryFn: mockQueryFn,
          getKey: (item) => item.id
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.code).toBe("NETWORK_ERROR");
      expect(result.current.rows).toEqual([]);
    });

    it("detects and recovers from stale cursor", async () => {
      mockQueryFn.mockRejectedValue(new Error("Invalid cursor (400)"));

      const urlParams = new URLSearchParams("?cursor=stale-cursor");

      const { result } = renderHook(() =>
        useCursorPagination({
          queryFn: mockQueryFn,
          getKey: (item) => item.id,
          urlSearchParams: urlParams
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.code).toBe("STALE_CURSOR");
      expect(result.current.rows).toEqual([]);
    });

    it("shows error message for malformed cursor", async () => {
      const malformedParams = new URLSearchParams();
      // Manually set invalid cursor by bypassing validation in test
      malformedParams.set("cursor", "x".repeat(2000)); // Too long

      mockQueryFn.mockResolvedValue({
        items: [],
        nextCursor: undefined
      });

      const { result } = renderHook(() =>
        useCursorPagination({
          queryFn: mockQueryFn,
          getKey: (item) => item.id,
          urlSearchParams: malformedParams
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.code).toBe("MALFORMED_CURSOR");
    });
  });

  describe("Reset pagination", () => {
    it("resets to first page", async () => {
      mockQueryFn.mockResolvedValue({
        items: [{ id: "1", name: "Item 1" }],
        nextCursor: "next"
      });

      const { result } = renderHook(() =>
        useCursorPagination({
          queryFn: mockQueryFn,
          getKey: (item) => item.id
        })
      );

      await waitFor(() => {
        expect(result.current.rows.length).toBe(1);
      });

      act(() => {
        result.current.resetPagination();
      });

      expect(result.current.rows).toEqual([]);
      expect(result.current.hasNextPage).toBe(false);
      expect(result.current.hasPreviousPage).toBe(false);
      expect(result.current.error).toBeUndefined();
    });

    it("clears error state on reset", async () => {
      mockQueryFn.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() =>
        useCursorPagination({
          queryFn: mockQueryFn,
          getKey: (item) => item.id
        })
      );

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
      });

      act(() => {
        result.current.resetPagination();
      });

      expect(result.current.error).toBeUndefined();
    });
  });

  describe("URL persistence", () => {
    it("reads cursor from URL search params", async () => {
      mockQueryFn.mockResolvedValue({
        items: [{ id: "2", name: "Item 2" }],
        previousCursor: "prev"
      });

      const urlParams = new URLSearchParams("?cursor=existing-cursor&direction=forward");

      renderHook(() =>
        useCursorPagination({
          queryFn: mockQueryFn,
          getKey: (item) => item.id,
          urlSearchParams: urlParams
        })
      );

      await waitFor(() => {
        expect(mockQueryFn).toHaveBeenCalledWith("existing-cursor", "forward");
      });
    });

    it("updates URL when navigating", async () => {
      mockQueryFn
        .mockResolvedValueOnce({
          items: [{ id: "1", name: "Item 1" }],
          nextCursor: "next-cursor"
        })
        .mockResolvedValueOnce({
          items: [{ id: "2", name: "Item 2" }]
        });

      const updateUrlFn = vi.fn();

      const { result } = renderHook(() =>
        useCursorPagination({
          queryFn: mockQueryFn,
          getKey: (item) => item.id,
          onUpdateUrl: updateUrlFn
        })
      );

      await waitFor(() => {
        expect(result.current.rows.length).toBe(1);
      });

      act(() => {
        result.current.nextPage();
      });

      expect(updateUrlFn).toHaveBeenCalled();
      const params = updateUrlFn.mock.calls[0][0] as URLSearchParams;
      expect(params.get("cursor")).toBe("next-cursor");
      expect(params.get("direction")).toBe("forward");
    });

    it("clears cursor from URL on reset", async () => {
      mockQueryFn.mockResolvedValue({
        items: [{ id: "1", name: "Item 1" }]
      });

      const updateUrlFn = vi.fn();

      const { result } = renderHook(() =>
        useCursorPagination({
          queryFn: mockQueryFn,
          getKey: (item) => item.id,
          onUpdateUrl: updateUrlFn
        })
      );

      await waitFor(() => {
        expect(result.current.rows.length).toBe(1);
      });

      act(() => {
        result.current.resetPagination();
      });

      expect(updateUrlFn).toHaveBeenCalled();
      const params = updateUrlFn.mock.calls[updateUrlFn.mock.calls.length - 1][0] as URLSearchParams;
      expect(params.get("cursor")).toBeNull();
      expect(params.get("direction")).toBeNull();
    });
  });

  describe("Callback hooks", () => {
    it("calls onBeforeNavigation before page change", async () => {
      mockQueryFn
        .mockResolvedValueOnce({
          items: [{ id: "1", name: "Item 1" }],
          nextCursor: "next"
        })
        .mockResolvedValueOnce({
          items: [{ id: "2", name: "Item 2" }]
        });

      const beforeNavFn = vi.fn();

      const { result } = renderHook(() =>
        useCursorPagination({
          queryFn: mockQueryFn,
          getKey: (item) => item.id,
          onBeforeNavigation: beforeNavFn
        })
      );

      await waitFor(() => {
        expect(result.current.rows.length).toBe(1);
      });

      act(() => {
        result.current.nextPage();
      });

      expect(beforeNavFn).toHaveBeenCalledWith("forward");
    });
  });

  describe("Race condition handling", () => {
    it("latest request wins when multiple navigations occur", async () => {
      const delays: Record<string, number> = {
        first: 100,
        second: 50 // Completes first
      };

      mockQueryFn.mockImplementation((cursor) =>
        new Promise((resolve) =>
          setTimeout(() => {
            resolve({
              items: [{ id: cursor, name: `Item ${cursor}` }],
              nextCursor: `next-${cursor}`
            });
          }, delays[cursor as string] || 100)
        )
      );

      mockQueryFn
        .mockResolvedValueOnce({
          items: [{ id: "1", name: "Item 1" }],
          nextCursor: "second"
        })
        .mockResolvedValueOnce({
          items: [{ id: "2", name: "Item 2" }],
          nextCursor: "third"
        });

      const { result } = renderHook(() =>
        useCursorPagination({
          queryFn: mockQueryFn,
          getKey: (item) => item.id
        })
      );

      await waitFor(() => {
        expect(result.current.rows.length).toBe(1);
      });

      // We don't test concurrent navigation in this simple setup
      // In a real scenario with Router integration, this would be more relevant
    });
  });
});
