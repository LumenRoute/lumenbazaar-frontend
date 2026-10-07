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
