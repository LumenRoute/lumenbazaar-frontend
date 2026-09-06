# LumenBazaar Frontend Testnet Release

This frontend release targets Stellar testnet first and keeps mainnet disabled by default.

## Deployment Environment

Set these public environment variables in Vercel or the target host:

```bash
NEXT_PUBLIC_LUMENBAZAAR_ENV=testnet
NEXT_PUBLIC_LUMENBAZAAR_API_URL=https://api.testnet.lumenbazaar.example
NEXT_PUBLIC_LUMENBAZAAR_DEFAULT_NETWORK=stellar:testnet
NEXT_PUBLIC_ENABLE_MAINNET=false
NEXT_PUBLIC_ENABLE_UPTO_SESSIONS=false
NEXT_PUBLIC_ENABLE_MCP_INSPECTOR=true
```

The API URL must point to the deployed backend facilitator. The example host above matches the
backend testnet deployment placeholder and should be replaced by the operator-controlled endpoint
before public reviewer testing.

## Verification Checklist

- Resource search renders `/explore` results from the backend or clearly falls back to local demo data.
- Seller onboarding renders `/seller/new-resource` and validates resource identity, pricing, metadata,
  snippets, and publish readiness before submission.
- Payment playground renders exact x402 requirements, verification results, settlement receipts, and
  Stellar transaction links without exposing private keys.
- Transactions render payment attempts, settlement status, failure codes, receipt IDs, and explorer links.
- Operator health renders API, worker, search, Redis, Postgres, RPC, and Horizon status rows.
- Conformance renders the latest persisted run from `/v1/conformance/runs`, including exact checks and
  reserved future `upto` checks.

## Known Limitations

- Wallet-backed authorization is displayed as a draft until backend wallet signing support is available.
- Mainnet is disabled unless `NEXT_PUBLIC_ENABLE_MAINNET=true` and backend mainnet acceptance criteria
  are completed.
- `upto` capped sessions are visible in the UI as readiness coverage but remain disabled until the
  backend and Soroban contract deployment advertise support.
- Local demo data is intentionally labeled when backend endpoints are unavailable.

## Local Testnet Run

```bash
copy .env.testnet.example .env.local
pnpm install
pnpm check
pnpm test:e2e
```
