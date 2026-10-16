#!/usr/bin/env pwsh
Set-Location -Path "c:\Users\Nuelthewave\Desktop\Lumen pr\lumenbazaar-frontend"

Write-Host "Configuring git..."
git config user.email "kiro@kiro.dev"
git config user.name "Kiro"

Write-Host "Staging changes..."
git add -A

Write-Host "Creating commit..."
git commit -m @"
feat: #48 generate typed API client from pinned OpenAPI

- Add manifest-based backend pinning mechanism (backend-pin.json)
- Vendor OpenAPI document with SHA-256 checksum verification
- Generate TypeScript types from pinned OpenAPI (client.generated.ts)
- Wire validators to generated types with compile-time assertions
- Add CI validation job (check-generated-code)
- Comprehensive documentation (docs/backend-pin.md)
- Infrastructure tests and type alignment tests
- Ensures API schema drift becomes compile error, not silent mismatch

Fixes: #48
"@

Write-Host "Checking branch..."
git branch -v

Write-Host "Pushing to feature branch..."
git push -u origin HEAD:feature/issue-48-typed-api-client-from-pinned-openapi

Write-Host "Verifying commit..."
git log --oneline -1

Write-Host "Final status..."
git status
