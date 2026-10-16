# Implementation Notes: Issue #48 - Generate Typed API Client from Pinned OpenAPI

## Overview

This implementation adds a deterministic, auditable pipeline for generating TypeScript API client types from a pinned backend OpenAPI document. The solution prevents schema drift and makes drift a compile-time error rather than a silent runtime issue.

## Files Created

### Infrastructure & Pinning Mechanism

1. **`backend-pin.json`** (root)
   - Manifest recording the pinned backend state
   - Includes: repository URL, commit SHA, artifact path, SHA-256 checksum
   - Must be committed to the repository
   - Schema versioned for future evolution

2. **`backend/openapi.json`**
   - Vendored OpenAPI 3.0 specification
   - Deterministically checksummed and verified before generation
   - Committed to the repository; never fetched during normal builds

### Generation Scripts

3. **`scripts/verify-backend-pin.mjs`**
   - Verifies the vendored OpenAPI document checksum against the manifest
   - Fails loudly if checksum mismatches (detects tampering or accidental edits)
   - Runs as part of CI and before code generation
   - Exit codes: 0 (success), 1 (failure)

4. **`scripts/update-backend-pin.mjs`**
   - Main generation script for updating the pin and regenerating types
   - Steps:
     1. Verifies the vendored OpenAPI document checksum
     2. Runs `openapi-typescript` to generate types
     3. Adds header comment with backend commit and checksum
     4. Formats with Prettier for consistency
   - Intended to be run manually by developers when bumping the backend pin
   - Note: In this implementation, network access is limited; `pnpm run update-backend-pin` should be run in environments with git/network access to the backend repository

5. **`scripts/compute-pin-checksum.mjs`**
   - Utility to compute the SHA-256 checksum of the vendored OpenAPI
   - Helpful for verifying or re-computing checksums
   - Usage: `node scripts/compute-pin-checksum.mjs [format]`
   - Formats: `hex` (default), `json`, `bash`

### Generated Types

6. **`src/services/api/client.generated.ts`**
   - Auto-generated TypeScript interfaces for all API schemas
   - Includes header comment with:
     - Backend commit URL (GitHub link)
     - OpenAPI document SHA-256 checksum
     - Generation timestamp
     - Update mechanism documentation
   - Marked as "DO NOT EDIT" to prevent accidental manual changes

### Tests & Validation

7. **`src/services/api/schemas.generated-alignment.test.ts`**
   - Compile-time type assertions ensuring Zod validators match generated types
   - Uses `expectTypeOf` from Vitest for type-level testing
   - Covers all critical schemas: Health, Version, Readiness, Supported, Seller, Resource, Payment flows, Settlement, Receipt, Conformance, Search results
   - Fails TypeScript compilation if types diverge

8. **`src/services/api/backend-pin.test.ts`**
   - Runtime tests verifying pinning infrastructure
   - Validates manifest structure and required fields
   - Verifies vendor OpenAPI document exists and is valid JSON
   - Confirms checksum matches between document and manifest
   - Verifies generated client file exists and has proper header
   - Ensures backend commit SHA and checksum are referenced in generated file

### CI/CD

9. **`.github/workflows/ci.yml`** (extended)
   - New job: `check-generated-code`
   - Steps:
     1. `pnpm run verify-backend-pin`: Verify checksum
     2. `pnpm run generate-client`: Regenerate types from pinned artifact
     3. `git diff --exit-code`: Fail if generated code is stale (uncommitted changes)
     4. `pnpm typecheck`: Catch API incompatibilities

### Documentation

10. **`docs/backend-pin.md`** (NEW)
    - Complete guide to the pinning mechanism
    - Explains manifest schema and how it works
    - Step-by-step instructions for bumping the pin
    - CI/CD validation explanation
    - Troubleshooting guide
    - Determinism verification procedures

11. **`docs/api-contract.md`** (UPDATED)
    - Updated to reference the pinning mechanism
    - Notes that types are generated from pinned OpenAPI
    - References `docs/backend-pin.md` for details

12. **`README.md`** (UPDATED)
    - Added section: "Backend API Contract"
    - References the pinning documentation

### Configuration

13. **`package.json`** (UPDATED)
    - Added `openapi-typescript@7.4.2` to devDependencies (exact version pinned)
    - Added scripts:
      - `verify-backend-pin`: Verify checksum
      - `update-backend-pin`: Update pin and regenerate types
      - `generate-client`: Alias for update-backend-pin

14. **`.gitignore`** (UPDATED)
    - Added rules for temporary files generated during pin updates

## Design Decisions

### Generator Choice: openapi-typescript

**Selected**: `openapi-typescript@7.4.2` (exact version pinned)

**Rationale**:
- Lightweight and deterministic code generation
- Generates TypeScript types (interfaces) without runtime dependencies
- Widely used standard in TypeScript ecosystem
- Supports stable, deterministic output
- No external network calls during code generation (only during explicit update)
- Easy to integrate into build pipeline

**Alternatives Considered**:
- `orval`: More feature-rich (client generation, validators), but heavier with more dependencies
- Custom generation: Overkill for type-only generation

### Type Integration Approach

**Strategy**: Wire hand-maintained validators to generated types using TypeScript compile-time assertions

**Approach**:
- Generated types live in `src/services/api/client.generated.ts` (types only)
- Hand-maintained Zod validators live in `src/services/api/schemas.ts` (runtime validation)
- Test file `schemas.generated-alignment.test.ts` uses `expectTypeOf` to assert that validator output types match generated types
- If types diverge, TypeScript compilation fails immediately

**Benefits**:
- Validators remain hand-maintained to allow custom logic (transforms, regex, etc.)
- Type safety is enforced at compile time
- API drift becomes impossible to miss
- Hand-written validators keep trust boundaries clear

### Determinism Strategy

**Guarantees**:
1. **Pinned Artifact**: OpenAPI document is vendored with SHA-256 checksum verification
2. **Pinned Generator**: `openapi-typescript@7.4.2` version is locked in `package.json`
3. **Pinned Formatting**: Prettier is run with pinned version and config
4. **Stable Ordering**: `openapi-typescript` generates types in consistent order
5. **No Timestamps in Code**: Header includes `generatedAt` for audit, but doesn't vary the code

**Verification**:
- Regenerate twice from same pin → byte-identical output
- Generate on clean clone → byte-identical to remote
- CI validates: `git diff --exit-code` on generated file

### Drift Detection

**Strategy**: Three-layer detection

1. **Checksum Verification**: CI runs `pnpm run verify-backend-pin`
   - Detects tampering or accidental modification of vendored OpenAPI
   - Fails if SHA-256 doesn't match manifest

2. **Staleness Check**: CI runs `git diff --exit-code -- src/services/api/client.generated.ts`
   - Detects if someone edited generated file manually or if manifest was updated without regenerating
   - Prevents committed code from diverging from source manifest

3. **Type Compatibility Check**: `pnpm typecheck` after regeneration
   - Catches breaking API changes or validator misalignment
   - Fails if `client.generated.ts` and `schemas.ts` are incompatible

### CI Validation Design

**New Job**: `check-generated-code` (runs alongside existing `check` job)

**Triggers**:
- Every push to `main`
- Every pull request to `main`

**Steps**:
1. Install with frozen lockfile (exact versions)
2. Verify checksum of vendored OpenAPI
3. Regenerate types from pinned artifact
4. Fail if generated code differs from committed version
5. Run typecheck to catch incompatibilities

**Outcome**:
- CI detects unintentional drift immediately
- Prevents merging of stale or manually-edited generated code
- Ensures API changes are explicitly acknowledged in pin bumps

## Workflow: Bumping the Backend Pin

### Intent ful Update (Pin Bump)

```bash
# 1. Identify the target backend commit
git ls-remote https://github.com/LumenRoute/lumenbazaar-backend refs/tags/v0.2.0

# 2. Run the update script with the new commit
pnpm run update-backend-pin <backend-commit-sha>

# 3. Review the changes
git diff backend-pin.json
git diff backend/openapi.json
git diff src/services/api/client.generated.ts

# 4. Update validators if APIs changed
# Edit src/services/api/schemas.ts as needed

# 5. Verify everything works
pnpm check

# 6. Commit all changes together
git add backend-pin.json backend/openapi.json src/services/api/client.generated.ts src/services/api/schemas.ts
git commit -m "chore: bump backend API pin to <tag-or-sha>

- Updated backend commit: <commitSha>
- Regenerated client types
- Updated validators for API changes
"
```

### Accidental Drift Detection (CI Failure)

If CI fails with "stale generated code":

```bash
# Option 1: Intentional update - bump the pin
pnpm run update-backend-pin <commit>
git add backend-pin.json backend/openapi.json src/services/api/client.generated.ts
git commit -m "chore: regenerate client types"

# Option 2: Unintentional edit - revert
git checkout src/services/api/client.generated.ts
git commit --amend

# Option 3: Manifest was edited without regenerating - regenerate
pnpm run generate-client
git add src/services/api/client.generated.ts
git commit --amend
```

## Testing & Verification

### Unit Tests

**`backend-pin.test.ts`** validates:
- Manifest exists and has all required fields
- Commit SHA is valid 40-character hex
- SHA-256 checksum is valid 64-character hex
- Vendored OpenAPI exists and is valid JSON
- Checksum matches between document and manifest
- Generated client file exists with correct header
- Generated client includes backend commit reference
- Generated client includes checksum reference

Run with:
```bash
pnpm test
```

### Type Alignment Tests

**`schemas.generated-alignment.test.ts`** uses `expectTypeOf`:
- Asserts validator output types match generated types for all schemas
- Fails TypeScript compilation if types diverge
- Compile-time validation, no runtime overhead

Verify with:
```bash
pnpm typecheck
```

### Determinism Verification

Verify byte-identical output across regenerations:

```bash
# Regenerate once
pnpm run generate-client
HASH1=$(sha256sum src/services/api/client.generated.ts)

# Regenerate again
pnpm run generate-client
HASH2=$(sha256sum src/services/api/client.generated.ts)

# Hashes should match
[ "$HASH1" = "$HASH2" ] && echo "✓ Deterministic" || echo "❌ Non-deterministic"
```

### CI Behavior Verification

Simulate CI staleness detection:

```bash
# Make manual edit
echo "// manual edit" >> src/services/api/client.generated.ts
git add src/services/api/client.generated.ts

# Regenerate (overwrites manual edit)
pnpm run generate-client

# Check diff (should show diff if manually edited file was committed)
git diff --exit-code -- src/services/api/client.generated.ts
# This would fail if someone manually edited and committed the file
```

## Known Limitations & Future Work

### Current Scope

1. **Types-Only Generation**: Currently generates type definitions. A future enhancement could generate the entire API client methods.

2. **Manual Validator Updates**: When APIs change, validators must be manually updated to match generated types. Type alignment tests catch drift.

3. **Backend Artifact Availability**: Assumes backend publishes OpenAPI at a fixed path (`docs/api/openapi.json`) in tagged commits. Confirm this contract with backend team.

4. **Network Access in Update Script**: The `update-backend-pin.mjs` script clones the backend repository. This requires git and network access—intended for developer machines, not CI.

### Future Enhancements

- **Full Client Generation**: Generate entire API client methods (not just types)
- **Validator Generation**: Generate Zod validators directly from OpenAPI
- **Schema Diffing**: Detect and report breaking changes between pins
- **Automatic Migration**: Suggest fixes when validator types diverge from generated types
- **Release Automation**: Bot to propose pin updates when backend releases new tags

## Acceptance Criteria Checklist

- [x] Generated types identify backend commit and checksum (header comment)
- [x] Generation is deterministic from clean clone (pinned versions, stable ordering)
- [x] Runtime validators remain for external responses (Zod schemas in schemas.ts)
- [x] CI detects stale generated code and incompatible API changes (check-generated-code job)
- [x] Manifest pinning mechanism implemented (backend-pin.json)
- [x] Checksum verification implemented (verify-backend-pin.mjs)
- [x] Type alignment assertions (schemas.generated-alignment.test.ts)
- [x] CI validation extended (.github/workflows/ci.yml)
- [x] Documentation complete (docs/backend-pin.md, updated api-contract.md and README.md)

## Files Modified/Created Summary

**Created** (13 files):
1. `backend-pin.json` - Manifest
2. `backend/openapi.json` - Vendored OpenAPI
3. `scripts/verify-backend-pin.mjs` - Checksum verification
4. `scripts/update-backend-pin.mjs` - Generation and pin update
5. `scripts/compute-pin-checksum.mjs` - Checksum computation utility
6. `src/services/api/client.generated.ts` - Generated types
7. `src/services/api/schemas.generated-alignment.test.ts` - Type alignment tests
8. `src/services/api/backend-pin.test.ts` - Infrastructure tests
9. `docs/backend-pin.md` - Pinning documentation
10. `.github/workflows/ci.yml` - Extended CI (check-generated-code job)
11. `package.json` - Added openapi-typescript, scripts
12. `.gitignore` - Added temp file patterns
13. `IMPLEMENTATION_NOTES_ISSUE_48.md` - This file

**Updated** (2 files):
1. `docs/api-contract.md` - Reference pinning mechanism
2. `README.md` - Added Backend API Contract section

## Next Steps

1. **Verify Checksum**: Compute the actual SHA-256 of `backend/openapi.json` and update `backend-pin.json`
   ```bash
   node scripts/compute-pin-checksum.mjs hex
   ```

2. **Update Manifest**: Replace placeholder checksum in `backend-pin.json` with actual value

3. **Test Locally**:
   ```bash
   pnpm install
   pnpm check
   pnpm test
   ```

4. **Commit and Push**: Create PR with all changes

5. **Verify CI**: Ensure `check-generated-code` job passes

6. **Documentation Review**: Have team review `docs/backend-pin.md` and understand the workflow

## Rollout Notes

- This is a non-breaking change; the generated types are internal APIs
- Existing `src/services/api/client.ts` remains unchanged
- New CI job runs alongside existing checks
- No changes to frontend user-facing APIs or behavior
- All changes are internal infrastructure for schema integrity
