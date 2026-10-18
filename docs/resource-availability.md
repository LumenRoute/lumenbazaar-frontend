# Resource availability and freshness

Catalog presence proves only that a resource was indexed. Explore cards and resource detail pages
show reachability and catalog freshness as two independent signals.

## Evidence source

Availability evidence is provided by the backend as an optional resource field:

```json
{
  "availability": {
    "status": "healthy | degraded | unavailable | unknown",
    "lastProbeAt": "2026-10-18T09:05:00.000Z",
    "lastSuccessfulProbeAt": "2026-10-18T09:05:00.000Z",
    "catalogUpdatedAt": "2026-10-18T09:00:00.000Z",
    "source": "catalog-prober",
    "message": "optional detail"
  }
}
```

The frontend never probes resource URLs directly from the browser. When the backend omits the
field, the state is `Unknown`.

## Resolution rules

- A successful probe older than **24 hours** is `Stale probe` and is never shown as healthy.
- A `healthy` or `degraded` status without a successful probe timestamp is `Unverified`.
- Malformed, missing, or future timestamps fail closed to `Unknown`.
- `unavailable` is terminal and rendered with a danger tone.
- `degraded` stays distinct from `unavailable`.
- Catalog freshness is derived from `availability.catalogUpdatedAt`, falling back to
  `updatedAt`, and goes `Stale` after **7 days** or `Unknown` without a reliable timestamp.

Tooltips on each badge state the evidence source and the timestamp that produced the state, so an
operator can tell what was checked and when.

## Coverage

- `src/services/resource-health.test.ts` covers healthy, degraded, unavailable, stale, unknown, and
  malformed evidence plus independence between availability and freshness.
- `src/components/resources/resource-card.test.tsx` exercises the card badges through the resource
  card; tooltips carry the source/timestamp explanation.
