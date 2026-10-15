# LumenBazaar Frontend Testnet Release

This release targets Stellar testnet. Mainnet and `upto` sessions remain disabled.

## Pinned Deployment

Deploy an exact frontend commit and record it with the matching backend release:

```text
Frontend commit: <required>
Frontend URL: <required>
Backend commit: <required>
Backend URL: <required>
Contract release/WASM hash: <required>
External reviewer run: pending until all fields above are real
```

The deployment is not release evidence while any field still contains a placeholder.

Set these public variables on the frontend host:

```bash
NEXT_PUBLIC_LUMENBAZAAR_ENV=testnet
NEXT_PUBLIC_LUMENBAZAAR_API_URL=https://<deployed-backend>
NEXT_PUBLIC_LUMENBAZAAR_DEFAULT_NETWORK=stellar:testnet
NEXT_PUBLIC_ENABLE_MAINNET=false
NEXT_PUBLIC_ENABLE_UPTO_SESSIONS=false
NEXT_PUBLIC_ENABLE_MCP_INSPECTOR=true
```

Before publishing, compare `/version`, `/ready`, `/v1/supported`, and `/openapi.json` directly with
the values rendered by the operator pages. Do not deploy with the example API hostname from
`.env.testnet.example`.

## Automated Gates

```bash
pnpm check
pnpm test:e2e
pnpm audit:prod
```

`pnpm test:e2e` runs the demo smoke suite and a testnet-mode release suite on desktop and mobile.
The release suite uses the production resource and payment components against an isolated HTTP
contract server. It simulates the paid-resource response and Freighter message boundary; it covers
discovery, canonical challenge display, wallet connection, durable receipt recovery, explorer
evidence, keyboard activation, error announcement, and long-value layout. It is not evidence of a
real signature or settlement.

The external gate makes no `page.route` calls and cannot pass on successful fixture interception:

```powershell
$env:LUMENBAZAAR_LIVE_BASE_URL = "https://<deployed-frontend>"
$env:LUMENBAZAAR_LIVE_RESOURCE_ID = "<active-paid-resource-id>"
$env:FREIGHTER_EXTENSION_PATH = "C:\path\to\unpacked\freighter"
pnpm test:e2e:live
```

Use a fresh, minimally funded testnet payer. Never place a seed phrase or private key in an
environment variable, fixture, trace, screenshot, or repository file.

## Five-Minute Reviewer Script

1. Open the pinned frontend URL in a signed-out browser profile and confirm the header says
   `testnet mode`, not `Demo data`.
2. Open Explore, select the active paid resource, request terms, and compare network, atomic amount,
   asset contract, recipient, resource URL, and expiry with the resource owner.
3. Connect a fresh Freighter testnet wallet, authorize once, and reject any prompt whose account,
   network, or terms differ from the reviewed values.
4. Submit the paid request once. Confirm the UI progresses through verification, paid resource call,
   settlement submission, and final receipt without requiring a second authorization.
5. Open the Stellar transaction link, compare its hash with the receipt, reload the frontend, and
   confirm the same receipt is recovered. Record the UTC time, frontend/backend commits, resource ID,
   receipt ID, transaction hash, and result in the release evidence.

## Telemetry

### Privacy-Safe Telemetry (Operational Only)

LumenBazaar frontend collects operational telemetry **only when explicitly enabled** via the `NEXT_PUBLIC_ENABLE_TELEMETRY` environment variable.

**What Is Collected (when enabled):**
- Event type and timestamp
- Session ID (opaque, random, non-wallet-specific)
- Network ID (stellar:testnet or stellar:pubnet)
- Deployment ID (optional hash of API endpoint for correlation)
- Event-specific bounded fields:
  - Wallet connection status (initiated, success/failure) with bounded error codes only
  - Payment verification, authorization, settlement timings (duration in milliseconds, capped at 5 minutes)
  - Resource fetch status and duration
  - UI error categories (bounded, non-sensitive)
  - Asset codes (alphanumeric, max 12 characters)

**What Is NEVER Collected:**
- Wallet addresses or accounts
- Private keys, seed phrases, or any cryptographic material
- Payment signatures or signed XDR
- Authorization entries or headers
- Transaction hashes or receipt IDs
- Raw error messages, stack traces, or response bodies
- Free-form user input or resource details
- Any nested or encoded sensitive data

**Validation and Redaction:**
1. Only allowlisted fields per event type are extracted
2. All collected fields are validated against strict bounds (enums, integer ranges, string patterns)
3. Two-layer defense: allowlist validation + pattern detection for sensitive data
4. Oversized payloads (>10 KB) are rejected
5. Any event containing sensitive data patterns is dropped without emission

**Enabling Telemetry:**

Set the environment variable on the frontend host:

```bash
NEXT_PUBLIC_ENABLE_TELEMETRY=true
```

Leave unset or set to `false` to disable (default):

```bash
NEXT_PUBLIC_ENABLE_TELEMETRY=false
# or omit entirely
```

**Testing Telemetry is Off:**

1. In development, set `NODE_ENV=development` and `NEXT_PUBLIC_ENABLE_TELEMETRY=false`, then open browser DevTools console.
2. Look for `[Telemetry Internal]` messages; if absent, telemetry is disabled.
3. In production, telemetry is disabled by default. No `NEXT_PUBLIC_ENABLE_TELEMETRY=true` means no collection.

**Sink Interface:**

The telemetry service uses a replaceable sink interface:
- `NoOpSink` (default when disabled): silently discards events
- `ConsoleSink` (development): logs events to console with `[Telemetry]` prefix
- Future sinks (e.g., `RemoteSink`) can be added without changing the telemetry API

Events sent to sinks are pre-validated and redacted; sinks do not perform additional filtering.

## Known Limitations

- Gate C remains pending until the frontend and Phase 24 backend are deployed and the external
  fresh-wallet run succeeds.
- The backend contract does not expose payment-attempt or seller-payment collection endpoints, so
  those live pages report the capability as unavailable instead of displaying fixtures.
- Mainnet is disabled. No testnet result is evidence of mainnet readiness.
- `upto` capped sessions remain disabled until backend and contract releases advertise support.
- The deterministic browser gate does not create a cryptographic signature or Stellar transaction;
  only `pnpm test:e2e:live` plus explorer evidence proves that path.
- Reviewed low/moderate advisories in unused wallet-kit branches are governed by
  `security/audit-exceptions.json`; `pnpm audit:prod` fails when that policy changes or expires.
