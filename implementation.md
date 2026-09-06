# LumenBazaar Frontend Implementation Plan

Source document: `../LUMENBAZAAR_FULL_PROJECT_DOCUMENTATION.md`

Repo role: the public web application for resource discovery, seller onboarding, payment testing, settlement inspection, operator visibility, and reviewer evidence.

Primary stack:

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui or equivalent component system
- TanStack Query
- Zod
- Stellar Wallets Kit
- Freighter support

Core pages:

- `/`
- `/explore`
- `/resources/[resourceId]`
- `/seller`
- `/seller/new-resource`
- `/seller/resources`
- `/seller/payments`
- `/playground`
- `/transactions`
- `/operators`
- `/operators/health`
- `/operators/conformance`
- `/docs`
- `/settings`

Implementation rules:

- Keep each phase small enough for one focused pull request.
- Use backend OpenAPI or generated schemas as the source of truth when available.
- Do not claim official Stellar, SDF, or SCF endorsement.
- Build testnet flows first.
- Show machine-readable errors clearly.
- Keep wallet and payment logic non-custodial.

## Phase 1: Repository Foundation

Parts:

- Scaffold the Next.js TypeScript application.
- Add Tailwind CSS and the selected component system.
- Add `README.md`, `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`, and `.editorconfig`.
- Add `.gitignore`, PR template, issue template, and GitHub Actions CI.

Completion check:

- Fresh clone can install dependencies, run lint, and start the dev server.

## Phase 2: App Shell

Parts:

- Create the global layout.
- Add top navigation for dashboard, explore, seller, playground, transactions, operators, docs, and settings.
- Add responsive container rules.
- Add shared loading, empty, and error surfaces.

Completion check:

- Every planned route renders a placeholder page without layout shifts.

## Phase 3: Runtime Configuration

Parts:

- Define frontend environment variables.
- Add network configuration for `stellar:testnet` and `stellar:pubnet`.
- Add facilitator API base URL configuration.
- Add feature flags for mainnet, `upto` sessions, and MCP tool inspection.

Completion check:

- Invalid or missing required configuration fails with a clear local error.

## Phase 4: Typed API Client

Parts:

- Add a generated or hand-authored API client from backend schemas.
- Add Zod validators for API responses until generated schemas exist.
- Configure TanStack Query providers.
- Add request correlation IDs and structured error parsing.

Completion check:

- Health, networks, resources, payments, and conformance client calls are typed.

## Phase 5: Local Fixtures

Parts:

- Add testnet resource fixtures.
- Add payment requirement fixtures.
- Add settlement receipt fixtures.
- Add conformance run fixtures.

Completion check:

- UI pages can be developed before the backend is live.

## Phase 6: Home Dashboard Metrics

Parts:

- Show indexed resource count.
- Show active seller count.
- Show settled payment count.
- Show settlement volume by network.
- Show supported networks, API uptime, and latest conformance result.

Completion check:

- Dashboard renders real data when available and fixture data in local demo mode.

## Phase 7: Explore Page Base

Parts:

- Build `/explore`.
- Add search input.
- Add results region.
- Add sort selector.
- Add pagination or cursor handling.

Completion check:

- Users can submit a search and see resource results.

## Phase 8: Resource Filters

Parts:

- Add network filter.
- Add asset filter.
- Add resource type filter.
- Add seller verification filter.
- Add price range filter.
- Add extension filter for Bazaar and MCP metadata.

Completion check:

- Filter state is reflected in the URL and backend query parameters.

## Phase 9: Resource Cards

Parts:

- Build `ResourceCard`.
- Show name, seller domain, type, network, asset, amount, and verification status.
- Show metadata quality and recent settlement status where available.
- Handle partial search results.

Completion check:

- Resource cards are scan-friendly on desktop and mobile.

## Phase 10: Resource Detail Summary

Parts:

- Build `/resources/[resourceId]`.
- Show resource name, description, seller domain, endpoint URL, and route template.
- Show network, `payTo`, asset, amount, and current status.
- Show public settlement history when available.

Completion check:

- A buyer can inspect the full payment terms before calling a resource.

## Phase 11: Schema Viewer

Parts:

- Build `ResourceSchemaViewer`.
- Render input schema.
- Render output schema.
- Add schema validation status.
- Add copy buttons for JSON examples.

Completion check:

- Schema displays are deterministic and readable for HTTP APIs and MCP tools.

## Phase 12: Payment Requirements Viewer

Parts:

- Build `PaymentRequirementViewer`.
- Show x402 scheme, network, asset, amount, recipient, expiry, and extensions.
- Show machine-readable failure reasons.
- Add copyable JSON payload view.

Completion check:

- Developers can inspect the exact 402 terms without reading raw network logs.

## Phase 13: Wallet Connection

Parts:

- Integrate Stellar Wallets Kit.
- Add Freighter support.
- Add wallet status component.
- Add network mismatch handling.
- Add disconnect behavior.

Completion check:

- Testnet wallet connection works without storing private keys.

## Phase 14: Seller Dashboard Base

Parts:

- Build `/seller`.
- Show seller identity status.
- Show domain verification status.
- Show resource count.
- Show recent payment attempts.

Completion check:

- A seller can see whether they are ready to publish paid resources.

## Phase 15: Seller Domain Verification

Parts:

- Build `SellerDomainVerifier`.
- Request backend verification challenge.
- Show DNS or well-known file instructions returned by the backend.
- Submit verification request.
- Display success and stable failure codes.

Completion check:

- Domain verification flow can be completed against backend test fixtures.

## Phase 16: New Resource Wizard Start

Parts:

- Build `/seller/new-resource`.
- Add resource name, description, type, endpoint URL, and route template steps.
- Validate route template syntax.
- Store draft state locally until submission.

Completion check:

- A seller can create a valid resource draft without payment settings.

## Phase 17: Resource Pricing Step

Parts:

- Add network selector.
- Add accepted asset selector.
- Add amount input.
- Add `payTo` address input.
- Add Stellar address validation.

Completion check:

- Invalid asset, amount, network, and recipient values are rejected before submission.

## Phase 18: Metadata Builder Step

Parts:

- Build `MetadataBuilder`.
- Add input schema editor.
- Add output schema editor.
- Add MCP metadata section for tool resources.
- Add preview of Bazaar metadata.

Completion check:

- Seller can generate metadata that matches backend validation expectations.

## Phase 19: Middleware Snippet Generator

Parts:

- Generate Express middleware snippet.
- Generate Fastify middleware snippet.
- Generate Next.js route helper snippet.
- Insert selected resource metadata into snippets.

Completion check:

- Snippets use `@lumenbazaar/seller-sdk` package names and testnet defaults.

## Phase 20: Resource Validation And Publish

Parts:

- Call `/v1/discovery/validate`.
- Show validation warnings and blocking errors.
- Submit resource to `/v1/resources`.
- Trigger cataloging when valid.

Completion check:

- Invalid metadata cannot be published from the UI.

## Phase 21: Seller Resource List ✓

Parts:

- Build `/seller/resources`. ✓
- Add table of seller resources. ✓
- Add status, network, asset, amount, and last indexed time. ✓
- Add edit, disable, and detail links. ✓

Completion check:

- Seller can manage published and draft resources. ✓

## Phase 22: Seller Payments ✓

Parts:

- Build `/seller/payments`. ✓
- Show payment attempts for the seller. ✓
- Show verification status, settlement status, amount, asset, and failure reason. ✓
- Link settled payments to receipts and transaction hashes. ✓

Completion check:

- Seller can reconcile recent payment activity. ✓

## Phase 23: Payment Playground Selection ✓

Parts:

- Build `/playground`. ✓
- Let user select a resource. ✓
- Generate a sample request from the input schema. ✓
- Trigger or simulate initial 402 response. ✓

Completion check:

- Developer can see the payment requirement generated for a chosen resource. ✓

## Phase 24: Payment Playground Verify ✓

Parts:

- Add authorization simulation path. ✓
- Add wallet-backed authorization path where backend support exists. ✓
- Submit payment payload to `/v1/verify`. ✓
- Show accepted and rejected verification states. ✓

Completion check:

- Testnet verification results are visible and machine-readable. ✓

## Phase 25: Payment Playground Settle ✓

Parts:

- Retry paid request after verification. ✓
- Submit settlement through the backend. ✓
- Show receipt ID, transaction hash, ledger, amount, asset, and seller. ✓
- Show failure codes for settlement failures. ✓

Completion check:

- A full testnet payment simulation can be run from the UI. ✓

## Phase 26: Transaction Dashboard

Parts:

- Build `/transactions`.
- Add filters for network, status, asset, seller, and date.
- Show payment attempts and settlements.
- Link transaction hashes to the configured Stellar explorer.

Completion check:

- Operators and reviewers can inspect successful and failed payments.

## Phase 27: Operator Dashboard

Parts:

- Build `/operators`.
- Show API status, supported networks, and configured assets.
- Show queue depth and settlement latency.
- Show RPC and Horizon health.

Completion check:

- Operator can quickly identify degraded backend dependencies.

## Phase 28: Operator Health Page

Parts:

- Build `/operators/health`.
- Render `OperatorHealthTable`.
- Add service-level status rows for API, worker, search, Redis, Postgres, RPC, and Horizon.
- Show last check time and recent failure reason.

Completion check:

- Health checks are readable without exposing secrets.

## Phase 29: Conformance Page

Parts:

- Build `/operators/conformance`.
- Show latest conformance run.
- Show `/supported`, `/verify`, and `/settle` pass or fail status.
- Show exact scheme and future `upto` scheme coverage.

Completion check:

- Reviewers can see conformance status without reading CI logs.

## Phase 30: MCP Tool Inspector

Parts:

- Build `McpToolInspector`.
- Show MCP server metadata.
- Render tool schemas for `search_paid_resources`, `inspect_resource`, and `call_paid_resource`.
- Show budget controls and deterministic error examples.

Completion check:

- Agent developers can inspect MCP tool contracts from the UI.

## Phase 31: Settings

Parts:

- Build `/settings`.
- Add network selection.
- Add facilitator URL override for local development.
- Add wallet preferences.
- Add local demo mode toggle.

Completion check:

- Developers can switch between local, testnet, staging, and mainnet-compatible settings.

## Phase 32: Documentation Links

Parts:

- Build `/docs`.
- Link to seller, buyer, agent, operator, API, contract, and security docs.
- Link each page to the canonical docs repo path.

Completion check:

- Frontend routes never become the canonical documentation source.

## Phase 33: Error And State Hardening

Parts:

- Normalize API errors into stable UI states.
- Add empty states for no resources, no payments, and unavailable conformance runs.
- Add retry actions where safe.
- Avoid logging payment payloads or sensitive wallet data.

Completion check:

- Failure states are clear to humans and still preserve machine-readable codes.

## Phase 34: Accessibility And Responsiveness

Parts:

- Add keyboard navigation checks.
- Add labels for form controls.
- Add responsive tests for mobile and desktop.
- Fix overflow and truncation for addresses, hashes, and schema content.

Completion check:

- Primary seller, buyer, operator, and playground flows work on mobile and desktop.

## Phase 35: Frontend Tests

Parts:

- Add component unit tests.
- Add form validation tests.
- Add API client tests.
- Add wallet mock tests.
- Add Playwright flows for explore, resource detail, seller onboarding, playground, and transactions.

Completion check:

- CI runs lint, typecheck, unit tests, and Playwright smoke tests.

## Phase 36: Testnet Release

Parts:

- Configure deployed frontend environment.
- Connect to testnet backend.
- Verify resource search, seller onboarding, playground, transactions, operator health, and conformance pages.
- Document known limitations.

Completion check:

- Testnet UI is usable by sellers, buyers, agents, operators, and reviewers.

## Phase 37: Mainnet Readiness

Parts:

- Enable mainnet only after backend mainnet acceptance criteria are met.
- Add explicit mainnet labels and warnings.
- Verify production asset configuration.
- Confirm the UI still exposes settlement details.

Completion check:

- Mainnet UI does not hide network, asset, amount, recipient, or transaction details.

## Phase 38: Maintenance

Parts:

- Add changelog process.
- Track frontend issues from Drips.
- Keep API schemas synchronized.
- Add regression tests for each fixed UI bug.

Completion check:

- The frontend can evolve without drifting from backend, docs, and contract behavior.
