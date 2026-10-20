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

`pnpm test:e2e` runs three suites:

1. **Demo smoke suite** (`tests/e2e/*.spec.ts` except connectivity): Local dev server with demo fixtures.
   Validates UI rendering, navigation, and event handling.

2. **Release suite** (`tests/release-e2e/`): Deterministic release gate using a mock HTTP server.
   Uses the production resource and payment components against an isolated contract server.
   Simulates the paid-resource response and Freighter message boundary; covers discovery,
   canonical challenge display, wallet connection, durable receipt recovery, explorer evidence,
   keyboard activation, error announcement, and long-value layout. It is not evidence of a
   real signature or settlement.

3. **Production connectivity suite** (`tests/e2e/connectivity.spec.ts`): Deployed frontend to backend.
   Verifies the frontend reaches the configured backend API without CORS failures.
   Asserts health, networks, resources, and conformance endpoints respond with valid schemas.
   Captures frontend and backend commit identifiers for release evidence.

The external gate makes no `page.route` calls and cannot pass on successful fixture interception:

```powershell
$env:LUMENBAZAAR_LIVE_BASE_URL = "https://<deployed-frontend>"
$env:LUMENBAZAAR_LIVE_RESOURCE_ID = "<active-paid-resource-id>"
$env:FREIGHTER_EXTENSION_PATH = "C:\path\to\unpacked\freighter"
pnpm test:e2e:live
```

Use a fresh, minimally funded testnet payer. Never place a seed phrase or private key in an
environment variable, fixture, trace, screenshot, or repository file.

## Release Screenshot Evidence

Release screenshots provide deterministic visual evidence of tested UI states tied to a specific commit and deployment.
Screenshots are automatically redacted to remove sensitive wallet data, addresses, and cryptographic material.

### Generating Release Screenshots

Generate screenshots from a clean repository clone:

```bash
# Local generation (requires mock server and built frontend)
pnpm screenshots:release

# Or step by step:
pnpm screenshots:generate        # Capture desktop + mobile screenshots
pnpm screenshots:organize        # Organize by variant, add commit/date metadata
```

Environment variables (optional):

```bash
# Set deployment URL for metadata (defaults to "pending")
LUMENBAZAAR_DEPLOYMENT_URL=https://testnet.lumenbazaar.com pnpm screenshots:release

# Use explicit commit hash (defaults to git HEAD)
LUMENBAZAAR_RELEASE_COMMIT=abc1234 pnpm screenshots:release
```

### Screenshot Coverage

Generated screenshots capture these deterministic states:

1. **Dashboard state** - Authenticated user overview and main navigation
2. **Explore discovery** - Resource listing interface and search functionality
3. **Payment terms display** - Resource detail with terms, challenge, and expiry countdown
4. **Wallet connection** - Freighter wallet connection confirmation and wallet selector UI
5. **Payment validation** - Terms validated and ready for settlement submission
6. **Receipt recovery** - Durable receipt recovered after page reload (session storage persistence)
7. **Receipt detail** - Transaction evidence, receipt ID, and Stellar explorer link
8. **Error states** - Challenge missing and other error handling with accessible announcements

### Browser Variants

Screenshots are captured for:
- **Desktop** - Chrome 1920x1080
- **Mobile** - Pixel 7 (mobile viewport)

### Artifact Naming Convention

Screenshot artifacts follow this deterministic naming pattern:

```
{OUTPUT_DIR}/{VARIANT}/{COMMIT_HASH}_{DATE}_{STATE}_{VARIANT}.png
```

Example:
```
test-results/screenshots/
├── desktop/
│   ├── a1b2c3d4e5f6_2026-10-15_dashboard-state-desktop.png
│   ├── a1b2c3d4e5f6_2026-10-15_explore-discovery-desktop.png
│   └── ...
├── mobile/
│   ├── a1b2c3d4e5f6_2026-10-15_dashboard-state-mobile.png
│   ├── a1b2c3d4e5f6_2026-10-15_explore-discovery-mobile.png
│   └── ...
└── metadata_a1b2c3d4e5f6.json
```

### Redaction and Data Privacy

All screenshots are automatically redacted before artifact generation:

- ✓ Stellar addresses (G + 55 alphanumeric chars)
- ✓ Contract IDs (C + 55 alphanumeric chars)
- ✓ Seed phrases (24 or 12-word mnemonic patterns)
- ✓ Private keys (secret/private key text and values)
- ✓ XDR encoded data (base64 signatures and transactions)
- ✓ Transaction hashes (64-character hex strings)

Redaction occurs at the DOM level before screenshot capture, replacing sensitive content with
readable placeholder text like `[STELLAR_ADDRESS_REDACTED]` and `[SEED_PHRASE_REDACTED]`.

### GitHub Actions Workflow

Automated screenshot capture is available via GitHub Actions. Trigger manually:

```bash
# Via GitHub CLI
gh workflow run release-screenshots.yml \
  -f deployment_url="https://testnet.lumenbazaar.com"

# Or in GitHub UI: Actions > Release Screenshots > Run workflow
```

The workflow:
1. Checks out the commit
2. Captures desktop and mobile screenshots
3. Organizes artifacts with commit hash and timestamp
4. Generates metadata JSON with frontend commit, branch, and deployment URL
5. Validates screenshot coverage (requires all states)
6. Creates compressed archive
7. Uploads artifacts (retained for 30 days)
8. Generates release evidence report

Artifacts are available in the workflow run:
- `release-screenshots-{COMMIT}-{DATE}` - Organized screenshot directory
- `release-screenshots-archive-{COMMIT}-{DATE}` - Compressed tar.gz
- `release-evidence-report-{COMMIT}-{DATE}` - Markdown evidence summary

### Metadata and Evidence Files

Generated metadata includes:

```json
{
  "releaseEvidence": {
    "frontend": {
      "commitHash": "a1b2c3d4e5f6",
      "branch": "main",
      "timestamp": "2026-10-15",
      "deploymentUrl": "https://testnet.lumenbazaar.com"
    },
    "screenshotVariants": ["desktop", "mobile"],
    "coverage": [
      "dashboard-state",
      "explore-discovery",
      "resource-detail",
      ...
    ],
    "redactionStatus": "sensitive-data-redacted",
    "generatedAt": "2026-10-15T17:00:00.000Z"
  }
}
```

Use this metadata when documenting release evidence in pull requests or release notes.

### Reproducibility

Screenshots are deterministic and reproducible from any clean clone:

1. Checkout the release commit:
   ```bash
   git checkout <commit-hash>
   git clean -fd
   ```

2. Generate screenshots:
   ```bash
   pnpm screenshots:release
   ```

3. Compare against archive from GitHub Actions:
   ```bash
   diff -r test-results/screenshots <extracted-archive>
   ```

Identical screenshots (byte-for-byte) across runs confirm determinism and rule out transient UI
rendering issues or network-dependent content.

## Production Deployment Verification

To verify production frontend to backend connectivity after deployment:

```powershell
$env:LUMENBAZAAR_PROD_FRONTEND_URL = "https://<deployed-frontend-url>"
pnpm test:e2e:prod-connectivity
```

This runs the production connectivity smoke suite against the deployed frontend and its configured
backend API. The test:

- Reaches the configured backend URL from the deployed frontend
- Validates `/ready` reports `ok: true` and `capabilities.exact: true`
- Validates `/v1/supported` includes a version 2 `exact` kind for the network
- Validates `/v1/discovery/search` returns resources with correct schema
- Validates `/openapi.json` or `/version` documents API compliance
- Detects CORS failures and schema violations
- Captures frontend and backend commit identifiers for evidence

If the test fails, check:
1. `NEXT_PUBLIC_LUMENBAZAAR_API_URL` is set correctly on Vercel
2. Backend API is deployed and accessible
3. CORS headers permit requests from the frontend domain
4. API endpoints respond with required schema fields

The connectivity test runs on both desktop and mobile browsers.

## Five-Minute Reviewer Script

1. Open the pinned frontend URL in a signed-out browser profile and confirm the header says
   `testnet mode`, not `Demo data`.
2. Open Explore, select the active paid resource, request terms, and compare network, atomic amount,
   asset contract, recipient, resource URL, and expiry with the resource owner. Confirm the live
   countdown appears and that the amber warning banner shows at or below 30 seconds remaining.
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

## Production Security Headers

Every response is served with the policy built in `src/config/security.ts` and applied by
`next.config.ts`. `connect-src` is limited to `'self'`, the configured backend API, and the
RPC and Horizon endpoints of `NEXT_PUBLIC_LUMENBAZAAR_DEFAULT_NETWORK`. Frame embedding is
disabled (`frame-ancestors 'none'`, `X-Frame-Options: DENY`) and no wildcard origins are
allowed.

Additional service origins (for example a documentation or wallet relay host) must be
declared explicitly and are validated as bare `https` origins:

```bash
NEXT_PUBLIC_LUMENBAZAAR_TRUSTED_ORIGINS=https://docs.stellar.org,https://wallet.example
```

`http` origins are accepted only for `localhost`/`127.0.0.1`. Wildcard, credential, path,
and query values fail configuration loading. `script-src` keeps `'unsafe-inline'` because
Next.js App Router hydration needs inline bootstrap scripts without a nonce; `unsafe-eval`
is never allowed. HSTS is emitted only when `NODE_ENV=production`.

## Known Limitations

- Gate C remains pending until the frontend and Phase 24 backend are deployed and the external
  fresh-wallet run succeeds.
- The countdown display and expiry banners use `aria-live="polite"` and are readable by screen
  readers. On mobile, the countdown appears inline next to the "Validated x402 v2 exact" badge and
  wraps naturally in narrow viewports. No additional mobile-specific styling is required.
- The backend contract does not expose payment-attempt or seller-payment collection endpoints, so
  those live pages report the capability as unavailable instead of displaying fixtures.
- Mainnet is disabled. No testnet result is evidence of mainnet readiness.
- `upto` capped sessions remain disabled until backend and contract releases advertise support.
- The deterministic browser gate does not create a cryptographic signature or Stellar transaction;
  only `pnpm test:e2e:live` plus explorer evidence proves that path.
- Reviewed low/moderate advisories in unused wallet-kit branches are governed by
  `security/audit-exceptions.json`; `pnpm audit:prod` fails when that policy changes or expires.
