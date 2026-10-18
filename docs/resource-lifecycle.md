# Resource disable and restore

`src/services/resource-lifecycle.ts` owns the safe discovery lifecycle for seller resources.

## Rules

- **Explicit confirmation** — the mutation requires `confirmation: true`, set only by the
  confirmation checkbox in the UI.
- **Reason capture** — disabling discovery requires a non-empty reason.
- **Current version** — the mutation receives the `updatedAt` of the row that was reviewed.
  A stale version raises `RESOURCE_CONFLICT`; the list refetches and no local status change is
  shown.
- **Accepted-result-only UI** — the table is refreshed from the query cache after the mutation
  resolves. There is no optimistic status flip.
- **Restore eligibility** — the backend decides whether an inactive version may be restored.
  A rejected eligibility response (`RESTORE_INELIGIBLE`) disables the restore action for that
  resource.
- **Duplicate actions** — identical resource + action mutations are coalesced; buttons also
  disable while a mutation is pending.
- **Outages** — `BACKEND_UNAVAILABLE` is retryable and leaves the existing list untouched.

## Backend capability

The pinned backend OpenAPI document exposes no disable or restore endpoint. Live modes
therefore use a fail-closed port that returns `UNSUPPORTED_CAPABILITY` and makes no request.
Explicit demo mode uses an in-session store seeded from bundled fixtures.

## Payments

Disabling discovery only changes discovery metadata. It does not revoke payment
authorizations or alter `payTo`, amount, or asset terms.
