# Discovery URL state

Explore results are driven entirely by validated URL query parameters. The URL is the source of
truth, so a copied link, a bookmark, or browser history always reproduces the same request.

## Supported parameters

| Parameter            | Values                                                  | Default     |
| -------------------- | ------------------------------------------------------- | ----------- |
| `q`                  | Free-text query, trimmed and capped at 200 characters   | none        |
| `sort`               | `relevance`, `price-asc`, `price-desc`, `recent`        | `relevance` |
| `network`            | `stellar:testnet`, `stellar:pubnet`                     | none        |
| `type`               | `http`, `mcp`                                           | none        |
| `extension`          | `bazaar`, `mcp`                                         | none        |
| `sellerVerification` | `any`, `verified`, `unverified`                         | `any`       |
| `asset`              | Trimmed identifier (`A-Za-z0-9:_.-`, max 128 chars)      | none        |
| `minPrice`           | Atomic decimal string (`^\d+(\.\d{1,7})?$`)             | none        |
| `maxPrice`           | Atomic decimal string (`^\d+(\.\d{1,7})?$`)             | none        |
| `cursor`             | Opaque pagination cursor, max 1024 characters           | none        |

## Normalization rules

- Unknown options, malformed prices, and malformed cursors are dropped, never forwarded to the
  backend.
- `q` is trimmed; defaults are omitted so equivalent states share one canonical link.
- If `minPrice > maxPrice`, the contradictory `maxPrice` is dropped and the lower bound is kept.
- Invalid timestamps or values in server data are handled by the resource health layer, not here.

## Behavior

- Submitting the form, changing a filter, changing the sort, or loading the next cursor page
  performs a client navigation that rewrites the query string, so **Back** and **Forward** restore
  the previous discovery state.
- Results are cached by query key (`staleTime` 30s), so history navigation re-renders cached
  results instead of issuing duplicate discovery requests.
- Wallet, seller-session, and payment-authorization state is intentionally **not** serialized.
- Invalid URL values are normalized on the server before rendering, so the client and server agree
  on the request that is made.

## Coverage

- `src/services/discovery-params.test.ts` covers round-tripping, canonicalization, rejection, and
  the guarantee that wallet/payment fields never reach the URL.
- `src/components/explore/explore-search.test.tsx` covers deep-link restoration and URL writes.
- `tests/e2e/discovery-deep-link.spec.ts` runs on the desktop and mobile Playwright projects.
