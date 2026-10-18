# Cursor Pagination Implementation Guide

## Overview

This document describes the cursor pagination system implemented for transaction and seller payment views in LumenBazaar. The implementation provides stable, backend-driven pagination with URL persistence, deduplication, and graceful error handling.

**Issue:** [#35](https://github.com/LumenRoute/lumenbazaar-frontend/issues/35)

## Architecture

### Core Hook: `useCursorPagination`

Located in `src/hooks/useCursorPagination.ts`, this reusable React hook encapsulates cursor pagination logic:

```typescript
const {
  rows,              // Current page items (deduplicated)
  isLoading,         // Loading state during fetch
  error,             // Error state (if any)
  hasNextPage,       // Can navigate forward
  hasPreviousPage,   // Can navigate backward
  nextPage,          // Function to navigate next
  previousPage,      // Function to navigate previous
  resetPagination    // Function to reset to first page
} = useCursorPagination({
  queryFn: async (cursor?, direction?) => {
    // Fetch page and return { items, nextCursor?, previousCursor? }
  },
  getKey: (item) => item.id,  // Stable ID for deduplication
  urlSearchParams: useSearchParams()
});
```

### Key Features

#### 1. **Cursor Management**
- Cursors are opaque tokens managed entirely by the backend
- Client never constructs, modifies, or decodes cursors
- Cursors are validated for format (max 1024 bytes, valid UTF-8)
- Invalid cursors are treated as first-page requests

#### 2. **URL Persistence**
- Cursor and direction stored in URL query params
- `?cursor=<token>&direction=forward` or `?cursor=<token>&direction=backward`
- Browser back/forward buttons restore correct page
- URL can be shared and restored on reload

#### 3. **Deduplication**
- Rows deduplicated by stable key using `getKey` extractor
- Deduplication preserves backend ordering (no reordering)
- Prevents duplicates across refetches and page transitions
- Implements O(1) dedup with `Set<string>` for performance

#### 4. **Error Handling**
- **Stale cursor:** Backend returns 400 → Shows error → Resets to first page
- **Malformed cursor:** Invalid format → Silent recovery → Treats as first page
- **Network error:** Connection failed → Shows error with retry option
- **Graceful recovery:** All errors reset to recoverable state

#### 5. **Race Condition Prevention**
- Uses `AbortController` to cancel old fetches when new navigation occurs
- Latest request always wins; older requests are discarded
- 30-second timeout to prevent hanging requests

#### 6. **Non-Destructive Loading**
- Loading indicator (spinner + overlay) does not blank the table
- Existing rows remain visible during page transition
- `aria-busy="true"` announced to screen readers

## Usage

### Transaction Dashboard

```typescript
import { useCursorPagination } from "@/hooks/useCursorPagination";

export function TransactionDashboard() {
  const searchParams = useSearchParams();

  // Build pagination filters (network, status, asset, etc.)
  const paginationFilters = useMemo(() => ({
    ...(asset === "all" ? {} : { asset }),
    ...(status === "all" ? {} : { status })
  }), [asset, status]);

  // Pagination hook
  const {
    rows: paginatedActivity,
    isLoading,
    error,
    hasNextPage,
    hasPreviousPage,
    nextPage,
    previousPage,
    resetPagination
  } = useCursorPagination({
    queryFn: async (cursor, direction) => {
      const filtered = loadPaymentActivity(paginationFilters, mode);
      // Fetch page and return paginated response
      return {
        items: filtered.slice(startIdx, endIdx),
        nextCursor: hasMore ? nextCursorValue : undefined,
        previousCursor: startIdx > 0 ? prevCursorValue : undefined
      };
    },
    getKey: (item) => item.attempt.id,
    urlSearchParams: searchParams as any
  });

  // Reset pagination when filters change
  if (filtersChanged) {
    resetPagination();
  }

  return (
    <>
      {/* Error banner */}
      {error && (
        <Card>
          <CardBody className="bg-red-50">
            <p>{error.message}</p>
            <Button onClick={resetPagination}>Start over</Button>
          </CardBody>
        </Card>
      )}

      {/* Loading state (non-destructive) */}
      <Card>
        <CardBody className="relative">
          {isLoading && <LoadingOverlay />}
          <table>
            {/* Table content */}
            {paginatedActivity.map(item => <Row key={item.id} item={item} />)}
          </table>
        </CardBody>

        {/* Pagination controls */}
        <div className="flex gap-2 justify-between">
          <Button onClick={previousPage} disabled={!hasPreviousPage || isLoading}>
            Previous
          </Button>
          <Button onClick={nextPage} disabled={!hasNextPage || isLoading}>
            Next
          </Button>
        </div>
      </Card>
    </>
  );
}
```

### Seller Payments

Same pattern as Transaction Dashboard. Example:

```typescript
export function SellerPayments({ sellerId }: { sellerId: string }) {
  const searchParams = useSearchParams();
  const previousSellerIdRef = useRef(sellerId);

  const { rows, isLoading, error, hasNextPage, hasPreviousPage, nextPage, previousPage, resetPagination } =
    useCursorPagination({
      queryFn: async (cursor) => {
        const activity = loadSellerPaymentActivity(sellerId);
        // Return paginated response
      },
      getKey: (item) => item.attempt.id,
      urlSearchParams: searchParams as any
    });

  // Reset if sellerId prop changes
  if (previousSellerIdRef.current !== sellerId) {
    resetPagination();
    previousSellerIdRef.current = sellerId;
  }

  // Render with pagination controls
}
```

## Implementation Details

### Cursor Response Schema

From backend API:

```typescript
interface PaginatedResponse<T> {
  items: T[];
  nextCursor?: string;  // Undefined if on final page
  previousCursor?: string; // Undefined if on first page
}
```

- `nextCursor` only present if more items exist forward
- `previousCursor` only present if items exist backward
- Both undefined on first/final pages

### Query Keys (React Query)

Located in `src/services/api/query.ts`:

```typescript
export const queryKeys = {
  transactions: (filters, cursor?, direction?) =>
    ["transactions", filters, cursor, direction] as const,
  sellerPayments: (sellerId, cursor?, direction?) =>
    ["sellerPayments", sellerId, cursor, direction] as const
};
```

Cache keys include cursor and direction for proper cache invalidation.

### Deduplication Algorithm

```typescript
function deduplicate<T>(newItems: T[], getKey, existingItems?) {
  const seen = new Set<string>();

  // Track existing keys
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
```

- O(n) algorithm with O(m) space for existing items
- Preserves order of new items
- Does not reorder or sort

### Filter Reset Pattern

When filters change, pagination must reset:

```typescript
// Track previous filters
const previousFiltersRef = useRef(paginationFilters);
const filtersChanged = JSON.stringify(previousFiltersRef.current) !== JSON.stringify(paginationFilters);

// Reset when filters change
if (filtersChanged) {
  resetPagination();  // Clears cursor from URL
  previousFiltersRef.current = paginationFilters;
}
```

### Error Recovery

| Error | Cause | Recovery |
|-------|-------|----------|
| **Stale Cursor** | Cursor expired or invalid on backend | Show banner, reset to first page |
| **Malformed Cursor** | Invalid format (too long, bad UTF-8) | Silent reset, treat as first page |
| **Network Error** | Connection failed, timeout | Show error, allow retry |
| **Invalid Response** | Backend response doesn't match schema | Show error, reset to first page |

### URL Management

Hook updates URL using Next.js navigation:

```typescript
const updateUrl = useCallback((newCursor, direction) => {
  const params = new URLSearchParams(searchParams);

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

  const newUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState(null, "", newUrl);
}, [searchParams]);
```

## Testing

### Unit Tests

Tests cover:
- Initial load with no cursor
- Next/previous page navigation
- Deduplication by stable key
- Backend order preservation
- Stale/malformed cursor handling
- Error state recovery
- URL persistence
- Callback functions

Location: `src/hooks/useCursorPagination.test.ts`

### Integration Tests

Verify:
- Empty first page behavior
- Final page disables next
- First page disables previous
- Filter change resets pagination
- Network error handling
- Concurrent navigation handling

### E2E Tests (Playwright)

Test coverage:
- Desktop pagination flow
- Mobile viewport (375px)
- Browser back/forward restoration
- Filter change resets pagination
- Screen reader announcements
- Loading state visibility

Location: `tests/e2e/pagination.spec.ts`

## Accessibility

### ARIA Labels

```typescript
<Button
  aria-label="Next page"
  onClick={nextPage}
  disabled={!hasNextPage}
>
  Next
</Button>

<Button
  aria-label="Previous page"
  onClick={previousPage}
  disabled={!hasPreviousPage}
>
  Previous
</Button>
```

### Live Regions

```typescript
<div aria-live="polite" aria-busy={isLoading}>
  {isLoading && <span>Loading page...</span>}
</div>
```

### Error Announcements

```typescript
{error && (
  <div role="alert">
    {error.message}
  </div>
)}
```

### Focus Management

After page load, focus returns to table or first new row:

```typescript
useEffect(() => {
  if (!isLoading && tableRef.current) {
    tableRef.current.focus();
  }
}, [isLoading]);
```

## Security Considerations

### Cursor Handling

- **Opaque:** Client never interprets cursors
- **Validated:** Format checked before use (max 1024 bytes, UTF-8)
- **Untrusted:** Treat cursor from URL as untrusted user input
- **Rejected:** Invalid cursors silently treated as first page

### Tamper Prevention

- Backend signs/encrypts cursors (not client concern)
- Invalid or modified cursors fail deterministically (400 from backend)
- Cursor timestamp can be validated server-side to detect stale cursors

### URL Parameter Injection

- Query params parsed safely using `URLSearchParams`
- No eval or dynamic code execution
- Cursor validated against schema before fetch

## Performance

### Deduplication

- O(1) set lookup for duplicate detection
- O(n) linear scan through items
- No sorting or reordering overhead
- Memory: O(m) for existing item keys + O(n) for new items

### Network

- Single fetch per page navigation
- Abort controller prevents zombie requests
- 30-second timeout per request
- No polling or background sync

### Rendering

- Loading overlay non-destructive (CSS overlay, no DOM changes)
- Table rows unchanged until new data arrives
- No forced re-renders during fetch
- Efficient deduplication prevents duplicate rows

## Extending to New Components

To add cursor pagination to a new component:

1. **Import hook:**
   ```typescript
   import { useCursorPagination } from "@/hooks/useCursorPagination";
   ```

2. **Add query function:**
   ```typescript
   const { rows, isLoading, hasNextPage, ... } = useCursorPagination({
     queryFn: async (cursor, direction) => {
       const items = await fetchData(cursor);
       return {
         items,
         nextCursor: items.length > 0 ? nextToken : undefined,
         previousCursor: cursor ? prevToken : undefined
       };
     },
     getKey: (item) => item.id,
     urlSearchParams: useSearchParams() as any
   });
   ```

3. **Add pagination controls:**
   ```typescript
   <Button onClick={nextPage} disabled={!hasNextPage || isLoading}>
     Next
   </Button>
   <Button onClick={previousPage} disabled={!hasPreviousPage || isLoading}>
     Previous
   </Button>
   ```

4. **Add error handling:**
   ```typescript
   {error && (
     <ErrorBanner message={error.message} onRetry={resetPagination} />
   )}
   ```

5. **Add filter reset:**
   ```typescript
   if (filtersChanged) {
     resetPagination();
   }
   ```

## Troubleshooting

### Rows appear duplicated

- Check `getKey` extractor returns unique, stable IDs
- Verify deduplication is comparing correct fields
- Test with mock data to isolate issue

### Pagination controls not appearing

- Check `hasPreviousPage` and `hasNextPage` props
- Verify cursor response includes `nextCursor` / `previousCursor`
- Test with console logging: `console.log({ nextCursor, previousCursor })`

### URL not updating on navigation

- Verify `useSearchParams` is used (not `useRouter`)
- Check `window.history.replaceState` is being called
- Test in browser DevTools: check URL changes on button click

### Error banner doesn't disappear

- Call `resetPagination()` on error reset button
- Verify error state is cleared in hook
- Test error recovery flow manually

## Related Files

- Hook: `src/hooks/useCursorPagination.ts`
- Hook tests: `src/hooks/useCursorPagination.test.ts`
- Query keys: `src/services/api/query.ts`
- Schema: `src/services/payments.ts` (PaginatedPaymentActivityResponse)
- Transaction Dashboard: `src/components/transactions/transaction-dashboard.tsx`
- Seller Payments: `src/components/seller/seller-payments.tsx`
- E2E tests: `tests/e2e/pagination.spec.ts`

## References

- [Issue #35](https://github.com/LumenRoute/lumenbazaar-frontend/issues/35)
- [React Query Documentation](https://tanstack.com/query/latest)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Web Accessibility Patterns](https://www.w3.org/WAI/patterns/)
