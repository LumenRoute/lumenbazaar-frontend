@echo off
cd /d "c:\Users\Nuelthewave\Desktop\Lumen pr\lumenbazaar-frontend"
git config user.email "kiro@kiro.dev"
git config user.name "Kiro"
git add -A
git commit -m "feat: #48 generate typed API client from pinned OpenAPI

- Add manifest-based backend pinning mechanism (backend-pin.json)
- Vendor OpenAPI document with SHA-256 checksum verification
- Generate TypeScript types from pinned OpenAPI (client.generated.ts)
- Wire validators to generated types with compile-time assertions
- Add CI validation job (check-generated-code)
- Comprehensive documentation (docs/backend-pin.md)
- Infrastructure tests and type alignment tests
- Ensures API schema drift becomes compile error, not silent mismatch

Fixes: #48"
git branch -v
git push -u origin HEAD:feature/issue-48-typed-api-client-from-pinned-openapi
git log --oneline -1
git status
pause
