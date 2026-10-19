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

### Backend API Contract

The frontend types are generated from the backend OpenAPI specification pinned at a specific backend commit to prevent schema drift. Generated types are wired to hand-maintained validators using compile-time type assertions.

For details on the pinning mechanism, how to update the pin, and what CI enforces, see [docs/backend-pin.md](docs/backend-pin.md).

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
testing. Set `NEXT_PUBLIC_LUMENBAZAAR_DOCS_URL` to the public docs deployment (defaults to
`https://lumenbazaar-docs.vercel.app`). See `docs/testnet-release.md` for the verification checklist
and known limitations.

## Documentation links

The in-app docs index links to canonical routes on the deployed docs site. The
route map lives in `src/services/docs-links.routes.json`; the UI and tests both
read it.

- Unit coverage: `pnpm vitest run src/services/docs-links.test.ts`
- Deployed smoke check: `pnpm check:docs-links` (fails on 404s, soft-404 pages
  and redirects that change the route)

## Related Repositories

- [Backend](https://github.com/LumenRoute/lumenbazaar-backend)
- [Contracts](https://github.com/LumenRoute/lumenbazaar-contracts)
- [Documentation](https://lumenbazaar-docs.vercel.app) ([source](https://github.com/LumenRoute/lumenbazaar-docs))
