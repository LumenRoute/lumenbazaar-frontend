# Changelog

## Unreleased

- Add x402 v2 challenge validation, Freighter authorization, paid retry, durable receipt recovery,
  live-data boundaries, desktop/mobile release gates, and repository governance.
- Add payment challenge countdown, expiry warning (amber at ≤30 s, red at 0), and disabled signing
  after expiry. Refreshing terms resets the fingerprint so stale authorization cannot be reused.
- Add a global offline and degraded-network status banner that shows browser, backend, and Stellar
  state with timestamps, deduplicates accessible announcements, and never auto-retries mutations.
- Add bounded discovery result density and visible-field preferences that persist locally without
  changing which results are returned, plus deterministic catalog loading skeletons.
- Add seller resource draft autosave with explicit age/schema recovery and discard actions, and a
  publish preview rendered from the same normalized payload that validation and submission use.

No frontend release is declared deployed until the fresh-wallet external gate passes.
