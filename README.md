# LumenBazaar Frontend

The public web application for LumenBazaar sellers, buyers, agents, reviewers, and operators.

## Stack

- Next.js
- TypeScript
- Tailwind CSS
- TanStack Query
- Zod
- Stellar Wallets Kit
- Freighter support

## Setup

```bash
pnpm install
pnpm dev
```

## Validation

```bash
pnpm check
pnpm test:e2e
```

## Environment

Copy `.env.example` to `.env.local` for local overrides.

```bash
NEXT_PUBLIC_LUMENBAZAAR_ENV=local
NEXT_PUBLIC_LUMENBAZAAR_API_URL=http://localhost:8080
NEXT_PUBLIC_LUMENBAZAAR_DEFAULT_NETWORK=stellar:testnet
NEXT_PUBLIC_ENABLE_MAINNET=false
NEXT_PUBLIC_ENABLE_UPTO_SESSIONS=false
NEXT_PUBLIC_ENABLE_MCP_INSPECTOR=true
```

For deployed testnet settings, copy `.env.testnet.example` or mirror those values in Vercel.

Testnet is the default target. Mainnet-compatible flows remain feature-flagged until the backend and
contract acceptance criteria are met.

## Testnet Release

The Next.js app is configured for Vercel through `vercel.json`. Set
`NEXT_PUBLIC_LUMENBAZAAR_API_URL` in Vercel to the deployed backend facilitator URL before reviewer
testing. See `docs/testnet-release.md` for the verification checklist and known limitations.

## Related Repositories

- `lumenbazaar-backend`
- `lumenbazaar-contracts`
- `lumenbazaar-docs`
