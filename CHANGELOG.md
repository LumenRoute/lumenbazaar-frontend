# Changelog

## Unreleased

- Add x402 v2 challenge validation, Freighter authorization, paid retry, durable receipt recovery,
  live-data boundaries, desktop/mobile release gates, and repository governance.
- Add payment challenge countdown, expiry warning (amber at ≤30 s, red at 0), and disabled signing
  after expiry. Refreshing terms resets the fingerprint so stale authorization cannot be reused.

No frontend release is declared deployed until the fresh-wallet external gate passes.
