# Receipt finality polling

Pending settlements are reconciled by repeating **only** `GET /v1/receipts/{receiptId}`.
Payment verification, the paid resource call, and settlement each run at most once per
payment attempt.

## Schedule

`src/services/polling.ts` implements the shared bounded backoff loop:

- exponential delays starting at 500 ms, doubling to an 8 s ceiling
- at most 8 receipt lookups and 45 s of wall-clock budget by default
- terminal on receipt status `finalized` or `failed`
- terminal on a definitive `4xx` verification rejection; timeouts and `429` stay pending

Callers may inject a schedule (`initialDelayMs`, `maxDelayMs`, `maxAttempts`, `maxElapsedMs`)
for tests.

## Traffic controls

- **Hidden tabs and offline browsers** pause lookups. The gate subscribes to
  `visibilitychange`, `online`, and `offline`; no receipt requests are issued while blocked.
- **Unmount/navigation** aborts in-flight lookups through `AbortSignal`; the outcome stays
  `pending` and the recovery record remains available.
- **Duplicate consumers** are coalesced by `paidFlowCoordinator`, so only one poll loop and one
  settlement request run for the same authorization.

## Manual resume

`PaidFlowOutcome.receiptLookupAttempts` reports how many lookups ran. When the budget is
exhausted the payment panel shows **Resume receipt check**, which calls the existing
`recover` path with the same stored recovery record. It never resubmits payment or settlement.

## Failure semantics

An exhausted budget is not success. The outcome stays `pending` with a message that receipt
finality is not available yet; only a durable `finalized` receipt produces `confirmed`.
