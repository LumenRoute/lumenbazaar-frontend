# Backend API Contract Pinning

## Overview

The LumenBazaar frontend maintains a **pinned OpenAPI document** from the backend repository at a specific commit. This ensures frontend types never drift from backend reality and drift becomes a compile-time error rather than a silent runtime issue.

### Why Pinning?

- **Determinism:** Builds are reproducible; the generated types are always derived from the same OpenAPI document.
- **Auditability:** The manifest records exactly which backend commit was used and the checksum of the artifact.
- **Integrity:** SHA-256 verification prevents accidental (or malicious) modification of the vendored OpenAPI.
- **Type Safety:** Generated types and hand-maintained validators are wired together; drift becomes a TypeScript compile error.

## Manifest Schema

The file `backend-pin.json` in the repository root records the pinned backend state:

```json
{
  "version": 1,
  "backend": {
    "repository": "https://github.com/LumenRoute/lumenbazaar-backend",
    "commitSha": "abc123def456abc123def456abc123def456abc1",
    "tag": "v0.1.0-rc1"
  },
  "artifact": {
    "path": "docs/api/openapi.json",
    "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  },
  "generatedAt": "2026-10-16T12:00:00Z",
  "generatedBy": "pnpm run update-backend-pin"
}
```

### Fields

- **backend.repository**: URL to the backend repository.
- **backend.commitSha**: Exact backend commit (40-char SHA-1). This is the source of truth.
- **backend.tag**: Optional human-readable reference (e.g., release tag). Aids communication.
- **artifact.path**: Path to the OpenAPI file within the backend repository.
- **artifact.sha256**: SHA-256 checksum of the vendored OpenAPI document. Used for integrity verification.
- **generatedAt**: ISO 8601 timestamp when the pin was last updated.
- **generatedBy**: Command or context that created the pin.

## Initial Pin

The backend is currently pinned at **API version 0.1.0** as of **2026-10-07**.

The vendored OpenAPI document is at `backend/openapi.json` and is checked into version control.

## Generated Types

**File:** `src/services/api/client.generated.ts`

This file is **auto-generated and should not be edited manually**. It contains TypeScript interfaces for all API endpoints, request/response bodies, and shared schemas.

The file includes a header comment identifying:
- The backend commit URL
- The OpenAPI document checksum
- The generation timestamp

```typescript
/**
 * ⚠️  AUTO-GENERATED FILE — DO NOT EDIT
 * Generated from pinned OpenAPI at backend commit:
 *   https://github.com/LumenRoute/lumenbazaar-backend/commit/abc123def456...
 * Document checksum (SHA-256):
 *   e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
 * ...
 */
```

## Runtime Validators

**File:** `src/services/api/schemas.ts`

Zod validators are **hand-maintained** and used to validate backend responses at trust boundaries. These validators are wired to the generated types with TypeScript compile-time assertions (see `src/services/api/schemas.generated-alignment.test.ts`).

If the backend OpenAPI changes and the generated types diverge from the validators, the type alignment test will fail at TypeScript compile time, alerting developers before code ships.

## Bumping the Pin

To update to a newer backend version:

### 1. Identify the Target Commit

Find the backend commit SHA you want to pin to. This is typically a tagged release or a specific merge commit on `main`.

```bash
# Example: Get the latest commit from a known tag
git ls-remote https://github.com/LumenRoute/lumenbazaar-backend v0.2.0
```

### 2. Run the Update Script

```bash
pnpm run update-backend-pin <backend-commit-sha>
```

This script:
- Clones the backend repository to a temporary directory
- Checks out the specified commit
- Extracts the OpenAPI document from `docs/api/openapi.json`
- Computes the SHA-256 checksum
- Copies the document to `backend/openapi.json` (vendored locally)
- Regenerates `src/services/api/client.generated.ts` with the new types
- Updates `backend-pin.json` manifest

### 3. Review the Changes

```bash
git status
git diff backend-pin.json
git diff backend/openapi.json
git diff src/services/api/client.generated.ts
```

Expect changes in:
- **backend-pin.json**: Updated commit SHA, checksum, timestamp
- **backend/openapi.json**: New OpenAPI schema (if the backend API changed)
- **src/services/api/client.generated.ts**: New or updated type definitions

### 4. Update Hand-Maintained Validators (if needed)

If the backend OpenAPI changed (new endpoints, new fields, schema changes), the generated types will reflect those changes. You must update `src/services/api/schemas.ts` to match.

**Failing tests will tell you which validators need updating:**

```bash
pnpm typecheck
pnpm test
```

If a validator's Zod schema doesn't match the generated type, the type alignment test (`schemas.generated-alignment.test.ts`) will fail at TypeScript compile time.

### 5. Verify Local Build

```bash
pnpm check
```

This runs:
- Format check
- Linting
- Type checking (catches validator/type mismatches)
- Unit and integration tests
- Production build

### 6. Commit All Changes Together

```bash
git add backend-pin.json backend/openapi.json src/services/api/client.generated.ts src/services/api/schemas.ts
git commit -m "chore: bump backend API pin to <tag or commit SHA>

- Updated backend commit: <commitSha>
- Updated OpenAPI schema version: <version>
- Regenerated client types
- Updated validators for API changes
"
```

## CI/CD Validation

The GitHub Actions workflow includes a `check-generated-code` job that runs on every push and pull request:

1. **Checksum Verification** (`pnpm run verify-backend-pin`):
   - Reads the manifest
   - Computes SHA-256 of the vendored OpenAPI document
   - Fails if checksum doesn't match (detects tampering or drift)

2. **Code Regeneration** (`pnpm run generate-client`):
   - Regenerates types from the pinned OpenAPI
   - Applies Prettier formatting

3. **Staleness Check** (`git diff --exit-code`):
   - Fails if the regenerated code differs from the committed version
   - Indicates stale generated code that needs to be regenerated locally

4. **Type Compatibility** (`pnpm typecheck`):
   - Ensures TypeScript compilation succeeds
   - Catches incompatibilities between validators and generated types

### If CI Fails

**"Checksum verification failed"**

The vendored `backend/openapi.json` was modified. Either:
- Revert the change (use `git checkout backend/openapi.json`)
- Or if intentional, re-pin to the modified document by running `pnpm run update-backend-pin <commit>`

**"Stale generated code"**

Someone edited `src/services/api/client.generated.ts` manually or `backend-pin.json` was updated without regenerating. Fix by:

```bash
pnpm run generate-client
git add src/services/api/client.generated.ts
git commit -m "chore: regenerate client types"
```

**"Type check failed"**

Validators in `src/services/api/schemas.ts` don't match the generated types. Update the validators to match, then re-run `pnpm typecheck`.

## Determinism Verification

To confirm the pinning mechanism produces deterministic builds:

### Regenerate Twice Locally

```bash
pnpm run generate-client
sha256sum src/services/api/client.generated.ts > hash1.txt
rm src/services/api/client.generated.ts
pnpm run generate-client
sha256sum src/services/api/client.generated.ts > hash2.txt
diff hash1.txt hash2.txt  # Should show no difference
```

### Test on Clean Clone

```bash
cd /tmp
git clone https://github.com/LumenRoute/lumenbazaar-frontend
cd lumenbazaar-frontend
pnpm install
pnpm run generate-client
# Verify no git diff:
git diff --exit-code -- src/services/api/client.generated.ts
```

## Troubleshooting

### Error: "Manifest not found"

Run `pnpm run verify-backend-pin` to check. The manifest must exist at `backend-pin.json` in the repo root.

### Error: "CHECKSUM MISMATCH"

The vendored OpenAPI document was modified. Either revert it or re-pin:

```bash
git checkout backend/openapi.json
# Or:
pnpm run update-backend-pin <commit>
```

### Error: "openapi-typescript generation failed"

The OpenAPI document may be invalid. Verify it's valid JSON:

```bash
jq . backend/openapi.json > /dev/null && echo "Valid JSON"
```

### Generation takes a long time

The update script clones the backend repository to a temporary directory. On slow networks, this may take a minute or more.

## Related Documentation

- **API Contract:** See `docs/api-contract.md` for the high-level API agreement and supported payment flows.
- **Runtime Configuration:** See `src/config/runtime.ts` for environment and backend URL configuration.
- **API Client:** See `src/services/api/client.ts` for the hand-maintained client methods.
- **Validators:** See `src/services/api/schemas.ts` for hand-maintained Zod validators.
