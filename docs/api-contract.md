# Frontend API contract

The runtime client and Zod schemas in `src/services/api` are generated from and validated against a **pinned backend OpenAPI document** to prevent schema drift. Types are generated from the OpenAPI spec and wired to hand-maintained Zod validators at trust boundaries using compile-time type assertions.

Generated types: `src/services/api/client.generated.ts` (auto-generated from the pinned OpenAPI at backend commit; see `docs/backend-pin.md` for the pinning mechanism and how to bump it).

Runtime validators: `src/services/api/schemas.ts` (hand-maintained Zod validators for external API responses; type-checked against generated types).

The supported payment boundary is x402 v2:

- `/ready` must report `ok: true` and `capabilities.exact: true`.
- `/v1/supported` must include a version 2 `exact` kind for the selected network.
- `/v1/verify` accepts the official payment payload and requirements container and returns
  `isValid` plus namespaced LumenBazaar evidence.
- `/v1/settle` returns the official `success` and `transaction` envelope plus namespaced durable
  settlement and receipt identifiers.
- `/v1/receipts/{receiptId}` returns correlation and evidence hashes with the receipt.

`demo`, `local`, `testnet`, and `mainnet` are separate runtime modes. Bundled fixtures are legal
only in explicit `demo` mode. Other modes reject incompatible versions, environment mismatches,
invalid schemas, unavailable backends, and missing payment capabilities.
