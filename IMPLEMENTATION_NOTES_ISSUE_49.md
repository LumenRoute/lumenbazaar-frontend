# Implementation Notes: Issue #49 - Accessibility Testing

## Summary

This document describes the implementation of automated accessibility checks across primary routes (Issue #49).

## What Was Implemented

### 1. Dependencies Added
- **`@axe-core/playwright@4.11.1`** — WCAG 2.x Level A/AA scanning library
- Added to `package.json` devDependencies

### 2. Core Fixtures & Helpers

#### `tests/fixtures/routes.ts`
- Central inventory of 12+ primary routes (`PRIMARY_ROUTES`)
- Route definitions include: path, name, platforms, optional skip reason
- Covers all major sections: dashboard, explore, seller, operators, settings, docs, playground, transactions, receipts
- `EXCLUDED_ROUTES` array for routes with documented reasons (currently empty)

#### `tests/fixtures/accessibility.ts`
- `runSharedAssertions()` function that validates 6 core accessibility patterns:
  1. Exactly one `<main>` landmark
  2. Consistent, labeled navigation and header
  3. Keyboard-accessible skip link to main content
  4. One `<h1>` with no skipped heading levels
  5. Logical focus order with visible focus indicators
  6. Status/alert live regions for loading/error/success states
- `getPageContext()` helper for debugging

#### `tests/fixtures/a11y-exceptions.ts`
- Framework for documenting known exceptions with:
  - `ruleId` (axe rule ID, e.g., "color-contrast")
  - `route` (where the issue exists)
  - `selector` (CSS selector or description)
  - `reason` (why the exception exists)
  - `owner` (responsible party)
  - `expiryDate` (ISO 8601 format, forces review)
- `validateExceptions()` function that validates:
  - No expired exceptions (today > expiryDate)
  - All required fields present
  - Date format is valid ISO 8601

### 3. E2E Test Suite

#### `tests/e2e/a11y.spec.ts`
Main Playwright test spec with three test blocks:

1. **Shared Assertions** — Runs `runSharedAssertions()` on all PRIMARY_ROUTES
   - Tests landmarks, headings, focus, live regions
   - Runs on both desktop and mobile automatically

2. **Axe Scanning** — Runs axe-core on all routes
   - Injects axe into page
   - Applies exceptions (filters them out)
   - Fails if violations remain after exception filtering
   - Detects stale exceptions (exception added but no violation found)

3. **Route Coverage Guard** — Validates route inventory
   - Checks that all nav links are in PRIMARY_ROUTES or EXCLUDED_ROUTES
   - Fails if unmaintained routes are discovered

### 4. Unit Test Suites

#### `tests/unit/a11y-exceptions.test.ts`
Vitest suite validating the exceptions framework:
- No expired exceptions
- All required fields (ruleId, route, selector, reason, owner, expiryDate)
- Valid date format (ISO 8601)
- No duplicate rule+route+selector combinations
- Owner field follows expected format

#### `tests/unit/routes.test.ts`
Vitest suite validating route coverage:
- PRIMARY_ROUTES covers all major sections
- Unique paths (no duplicates)
- Valid path format (starts with /)
- No trailing slashes (except root /)
- At least 10 primary routes

### 5. Documentation

#### `docs/accessibility-testing.md`
Comprehensive guide including:
- Overview of what's tested
- How to run tests locally (`pnpm test:e2e:a11y`, specific routes, desktop/mobile)
- Test structure explanation
- Step-by-step process for adding new routes
- How to add/renew exceptions
- Exception validation details
- CI integration explanation
- Troubleshooting guide
- Accessibility checklist for new features
- Links to WCAG and accessibility resources

### 6. CI Integration

Updated `.github/workflows/ci.yml`:
- Added `pnpm test:e2e:a11y` step after existing tests
- Runs a11y tests on both desktop (Chrome) and mobile (Pixel 7) viewports
- Runs on every PR and main branch push

### 7. Package.json Updates

Added script:
```json
"test:e2e:a11y": "playwright test --config playwright.config.ts tests/e2e/a11y.spec.ts"
```

## File Structure

```
lumenbazaar-frontend/
├── package.json                          (updated: added @axe-core/playwright, test:e2e:a11y)
├── .github/workflows/ci.yml               (updated: added a11y test step)
├── docs/
│   └── accessibility-testing.md           (new: comprehensive guide)
├── tests/
│   ├── fixtures/
│   │   ├── routes.ts                      (new: route inventory)
│   │   ├── accessibility.ts               (new: shared assertions)
│   │   └── a11y-exceptions.ts             (new: exceptions framework)
│   ├── e2e/
│   │   └── a11y.spec.ts                   (new: main a11y test suite)
│   └── unit/
│       ├── a11y-exceptions.test.ts        (new: exceptions validation)
│       └── routes.test.ts                 (new: route coverage validation)
└── commit-a11y.js                         (helper: commit script)
```

## Routes Covered

The following 14 primary routes are now scanned:

1. `/` — Dashboard
2. `/explore` — Explore
3. `/seller` — Seller Dashboard
4. `/seller/new-resource` — Seller - New Resource
5. `/seller/resources` — Seller - Resources
6. `/seller/payments` — Seller - Payments
7. `/operators` — Operators Dashboard
8. `/operators/health` — Operators - Health
9. `/operators/conformance` — Operators - Conformance
10. `/settings` — Settings
11. `/docs` — Documentation
12. `/resources/resource_weather_api` — Resource Detail
13. `/playground` — Payment Playground
14. `/transactions` — Transactions
15. `/receipts/receipt_weather_001` — Receipt Detail

## How to Use

### Run a11y Tests

```bash
# All tests (desktop + mobile)
pnpm test:e2e:a11y

# Desktop only
pnpm exec playwright test a11y.spec.ts --project=desktop

# Mobile only
pnpm exec playwright test a11y.spec.ts --project=mobile

# Specific route
pnpm exec playwright test a11y.spec.ts -g "Dashboard"

# With verbose output
pnpm exec playwright test a11y.spec.ts --reporter=verbose
```

### Run Unit Tests

```bash
# All tests (including a11y fixture validations)
pnpm test

# Specific suite
pnpm test a11y-exceptions
pnpm test routes
```

### Add a New Route

1. Add to `tests/fixtures/routes.ts`:
   ```typescript
   { path: "/my-new-route", name: "My New Route" }
   ```

2. Run tests:
   ```bash
   pnpm test:e2e:a11y
   ```

3. Fix any violations or add exceptions

### Add an Exception

1. Edit `tests/fixtures/a11y-exceptions.ts`:
   ```typescript
   {
     ruleId: "color-contrast",
     route: "/playground",
     selector: ".demo-badge",
     reason: "Demo styling. Will fix in Q4 2026.",
     owner: "@ui-team",
     expiryDate: "2026-12-31"
   }
   ```

2. Run tests to validate:
   ```bash
   pnpm test
   pnpm test:e2e:a11y
   ```

## Next Steps / Known Limitations

### What Still Needs to Be Done

1. **Run Initial Scan**: Execute `pnpm test:e2e:a11y` to identify any real defects
   - Note: Terminal environment had issues during implementation; scripts may need adjustment
   - May need to install dependencies first: `pnpm install` (to fetch @axe-core/playwright)

2. **Fix Real Defects**: Address any WCAG violations found
   - Small fixes in scope: missing skip link, incorrect landmarks, missing labels
   - Not in scope: UI redesigns or major component changes

3. **Document Exceptions**: For any violations that aren't fixed, add to exceptions framework
   - Must include owner, reason, and expiry date
   - Exceptions expire automatically, forcing review

4. **Verify Desktop + Mobile**: Run tests on both viewports
   - Desktop: Chrome browser
   - Mobile: Pixel 7 emulation

### Known Issues

- **Terminal Environment**: The PowerShell environment had intermittent issues during implementation
  - Solution: Use bash/zsh or run commands manually from IDE terminal
  - Alternative: Run `node commit-a11y.js` script to automate git operations

- **@axe-core/playwright Installation**: May need explicit `pnpm install` if not auto-resolved
  - Run: `pnpm install --frozen-lockfile` before running tests

## Test Outputs & Validation

### Shared Assertions
Each assertion logs:
- Number of landmarks found
- Heading hierarchy
- Focus element
- Live regions
- Skip link status

### Axe Scanning
Reports:
- Violation rule ID, impact, and affected nodes
- Number of exceptions applied
- Violations remaining (test passes if 0)

### Exception Validation
Checks:
- Expired dates (fails if expiryDate < today)
- Stale exceptions (fails if exception found but no violation exists)
- Malformed entries (fails if owner, reason, or expiryDate missing)

## Accessibility Scope

### What's Tested (Automated)

✅ Landmarks (main, nav, header, footer)  
✅ Heading hierarchy (h1 count, no skips)  
✅ Focus indicators and tab order  
✅ ARIA labels and roles  
✅ Color contrast (basic detection)  
✅ Form labels  
✅ Alt text for images  
✅ Live region announcements  

### What's NOT Tested (Manual Review Required)

❌ Screen reader compatibility  
❌ Keyboard navigation edge cases  
❌ Complex interaction patterns  
❌ Content readability and clarity  
❌ Color blindness simulation  
❌ WCAG 3.0 or AAA compliance  

## References

- **Design Document**: See "Issue #49: Design & Implementation Plan" artifact
- **WCAG 2.1**: https://www.w3.org/WAI/WCAG21/quickref/
- **Axe Rules**: https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md
- **MDN Accessibility**: https://developer.mozilla.org/en-US/docs/Web/Accessibility
- **Playwright Testing**: https://playwright.dev/docs/accessibility-testing

## Commit Information

**Branch**: `issue-49-accessibility-checks`  
**Files Changed**: 9 new files, 2 modified files  
**Total Lines**: ~1,800 (fixtures, tests, docs)  

To commit and push (if PowerShell script doesn't work):

```bash
# Create branch
git checkout -b issue-49-accessibility-checks

# Stage files
git add package.json
git add .github/workflows/ci.yml
git add tests/fixtures/routes.ts
git add tests/fixtures/accessibility.ts
git add tests/fixtures/a11y-exceptions.ts
git add tests/e2e/a11y.spec.ts
git add tests/unit/a11y-exceptions.test.ts
git add tests/unit/routes.test.ts
git add docs/accessibility-testing.md

# Commit
git commit -m "feat(a11y): Add automated accessibility checks across primary routes (#49)

- Install @axe-core/playwright for WCAG 2.x Level A/AA scanning
- Create central route inventory with coverage guard
- Implement shared accessibility assertions (landmarks, headings, focus)
- Build exceptions framework with owner and expiry dates
- Create unit test suites for validation
- Wire a11y tests into CI (desktop + mobile)
- Add comprehensive documentation"

# Push
git push -u origin issue-49-accessibility-checks
```

## Summary Checklist

- [x] Route inventory created (PRIMARY_ROUTES)
- [x] Shared assertions implemented (6 core patterns)
- [x] Axe-core scanning integrated
- [x] Exceptions framework built with validation
- [x] E2E test suite created
- [x] Unit test suites for fixtures
- [x] Documentation written
- [x] CI workflow updated
- [x] Package.json updated with script and dependency
- [ ] Initial scan run (awaiting terminal environment fix)
- [ ] Real defects identified and fixed
- [ ] Desktop and mobile verified
- [ ] Pull request created
- [ ] Merged to main

---

**Author**: Kiro (Automated Implementation)  
**Date**: 2026-10-16  
**Status**: Ready for Testing & Validation
