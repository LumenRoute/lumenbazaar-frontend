# Paid resource comparison

`/explore/compare?ids=<id>,<id>` compares a bounded set of paid resources side by side.

## Selection rules

- Up to **4** resources (`maxComparisonResources`).
- Ids are deduplicated, validated (`^[A-Za-z0-9_-]{1,128}$`), and truncated to the bound, so a
  crafted link cannot request an unbounded comparison.
- The compare link is only enabled once at least two resources are selected in Explore.

## Data source

- Outside demo mode, comparison always loads **live API records** via
  `GET /v1/resources/{resourceId}`. There is no fixture fallback in live modes.
- Records that cannot be loaded are reported as unavailable and are never silently substituted.
- In explicit demo mode (`NEXT_PUBLIC_LUMENBAZAAR_ENV=demo`), synthetic fixtures are used and the
  view is labeled `Explicit demo records`.

## Compared fields

Network, type, asset code, asset contract, atomic amount, recipient, seller, seller verification,
availability, last successful probe, catalog update time, request schema, and response schema.

- Missing values render as `Unknown`; presence of a catalog record is never treated as evidence of
  reachability or quality.
- Network and asset-contract differences are prominent, and a schema difference is reported as
  `incompatible`, because integrations cannot be swapped between them directly.
- No aggregate security or quality score is computed or displayed.

## Coverage

- `src/services/resource-comparison.test.ts` covers live-record loading, unavailable records, demo
  fixtures, partial data, mismatched networks/contracts, and incompatible schemas.
- `src/components/resources/resource-comparison.test.tsx` covers the responsive mobile cards and
  desktop table plus the empty-selection state.
- `tests/e2e/discovery-deep-link.spec.ts` verifies the shareable comparison link on desktop and
  mobile.
