#!/bin/bash
# This script commits and pushes the Issue #48 implementation changes

set -e

echo "🔄 Configuring git..."
git config user.email "kiro-agent@kiro.dev" || true
git config user.name "Kiro Agent" || true

echo "📋 Checking git status..."
git status --short | head -20

echo "➕ Staging all changes..."
git add -A

echo "✍️  Committing changes..."
git commit -m "feat: #48 generate typed API client from pinned OpenAPI

- Add manifest-based backend pinning mechanism (backend-pin.json)
- Vendor OpenAPI document with SHA-256 checksum verification
- Generate TypeScript types from pinned OpenAPI (client.generated.ts)
- Wire validators to generated types with compile-time assertions
- Add CI validation (check-generated-code job)
- Comprehensive documentation (docs/backend-pin.md)
- Ensures API schema drift becomes compile error, not silent mismatch

Key Files:
- backend-pin.json: Manifest recording backend commit, artifact path, checksum
- backend/openapi.json: Vendored OpenAPI document
- scripts/verify-backend-pin.mjs: Checksum verification
- scripts/update-backend-pin.mjs: Generation and pin update script
- src/services/api/client.generated.ts: Generated types with header
- src/services/api/schemas.generated-alignment.test.ts: Type alignment tests
- docs/backend-pin.md: Complete pinning guide
- .github/workflows/ci.yml: Extended with check-generated-code job

Fixes: #48
"

echo "🚀 Pushing to new branch..."
git push -u origin "feature/issue-48-typed-api-client-from-pinned-openapi" || \
git push -u origin "issue-48-typed-api-client" || \
git push -u origin "issue-48" || \
echo "Push failed - you may need to create the branch manually or use existing branch"

echo "✅ Done! Changes committed and pushed."
echo "   Next: Create a pull request from your feature branch to main."
