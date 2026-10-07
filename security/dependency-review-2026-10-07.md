# Frontend Dependency Review - 2026-10-07

- Next and `eslint-config-next` are aligned at 16.4.0, which is outside the audited critical
  `next/og` range.
- Wallet kit is 2.7.1. Its declared `@stellar/stellar-sdk` range is `^17.0.0`; the override resolves
  the graph to one compatible SDK version, 17.2.1.
- Axios 1.20.0, Sharp 0.35.5, source-map-js 1.2.2, and smol-toml 1.9.0 are compatible patched
  resolutions of vulnerable transitive versions.
- The application does not import `next/og`, `ImageResponse`, or `next/image`, so there is no image
  generation or optimization route to exercise beyond the production build.
- Remaining low/moderate advisories are isolated to unused hot-wallet/Solana branches and are
  tracked in `security/audit-exceptions.json`. CI fails on unknown findings, any high/critical
  finding, stale exceptions, or expiration.

Do not add major-version overrides for `uuid` or `stream-json`; their current parents declare older
contracts. Re-check wallet-kit releases before 2026-11-07 and remove exceptions as upstream paths
are updated.
