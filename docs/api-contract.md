# Frontend API contract

The runtime client and Zod schemas in `src/services/api` were reviewed against
`lumenbazaar-backend/docs/api/openapi.json` at backend API version `0.1.0` on 2026-10-07.

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
