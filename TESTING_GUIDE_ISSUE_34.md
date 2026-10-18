# Testing Guide: Issue #34 - Asset Trust Verification

## Overview

This guide provides comprehensive testing instructions for the asset trust verification feature (Issue #34). It covers unit tests, component tests, UI tests, and E2E testing scenarios.

## Test Execution

### Unit Tests

```bash
# Run all unit tests
pnpm test

# Run only asset trust tests
pnpm test asset-trust

# Run with coverage
pnpm test -- --coverage
```

**Expected Output**:
```
✓ Asset Trust Classification (25 tests)
  ✓ classifyAssetTrust (6 suites, 25+ cases)
    ✓ trusted assets (3 tests)
    ✓ unknown assets (3 tests)
    ✓ lookalike-symbol assets (1 test)
    ✓ malformed assets (4 tests)
    ✓ case sensitivity (1 test)
    ✓ network separation (1 test)
  ✓ assetTrustLabel (4 tests)

✓ Contract Address Comparison (16 tests)
  ✓ rendering (6 tests)
  ✓ match/mismatch detection (2 tests)
  ✓ copy to clipboard (4 tests)
  ✓ accessibility (3 tests)
  ✓ responsive design (1 test)

✓ Payment Requirement Viewer (20 tests)
  ✓ trusted asset (2 tests)
  ✓ unknown asset warning (3 tests)
  ✓ confirmation checkbox (5 tests)
  ✓ proceed button (2 tests)
  ✓ malformed asset (3 tests)
  ✓ lookalike detection (1 test)
  ✓ no asset contract ID (1 test)
  ✓ accessibility (3 tests)

TOTAL: 61 tests passed
```

### Type Checking

```bash
# Verify TypeScript types
pnpm typecheck

# Should show 0 errors for new files:
# - src/services/api/asset-trust.ts
# - src/components/resources/contract-address-comparison.tsx
# - src/components/resources/payment-requirement-viewer.tsx (updated)
```

### Linting

```bash
# Check code style
pnpm lint

# Should show 0 errors for new files
```

### Full Validation

```bash
# Run all checks
pnpm check

# Should pass: format, lint, typecheck, test, build
```

## E2E Testing

### Playwright E2E Tests

```bash
# Run E2E tests for asset trust verification
pnpm test:e2e asset-trust-verification

# Run specific test
pnpm exec playwright test asset-trust-verification.spec.ts -g "unknown asset warning"

# Run with headed mode (see browser)
pnpm exec playwright test asset-trust-verification.spec.ts --headed

# Run on specific project
pnpm exec playwright test asset-trust-verification.spec.ts --project=chromium
```

**Test Suites**:
1. Desktop Viewport (1024x768)
2. Mobile Viewport (375x667)
3. Keyboard Navigation
4. Accessibility
5. Lookalike Detection
6. Error Scenarios
7. Visual Regression

### Manual E2E Testing

#### Setup
1. Start the frontend dev server: `pnpm dev`
2. Open browser to `http://localhost:3000`
3. Navigate to a resource detail page

#### Scenario 1: Trusted Asset (USDC on Testnet)

**Steps**:
1. Navigate to `/resources/resource_weather_api` (or any resource using trusted USDC)
2. Scroll to payment requirement section

**Expected Results**:
- [x] Green "Trusted Asset" badge is visible
- [x] "Trusted asset (USDC)" label appears
- [x] Normal payment viewer is displayed
- [x] No warning card is shown
- [x] Contract address is displayed in monospace
- [x] "Contract addresses match" indicator is green
- [x] Full contract address is visible (56 chars)

#### Scenario 2: Unknown Asset

**Setup**:
1. Create or navigate to a resource with unknown asset contract ID
   - Contract: `CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC`
   - Network: `stellar:testnet`

**Steps**:
1. Navigate to resource detail page
2. Observe payment requirement section

**Expected Results**:
- [x] Amber warning card is visible
- [x] Warning heading: "Unknown Asset"
- [x] Warning text mentions "not in the trusted registry"
- [x] Full contract address is displayed (56 chars, monospace)
- [x] Contract comparison shows "not in the trusted registry for this network"
- [x] Confirmation checkbox is visible and **NOT checked**
- [x] Confirmation text: "I understand this asset is not in the trusted registry"
- [x] "Proceed with Unknown Asset" button is **DISABLED**
- [x] Normal payment viewer is **NOT displayed**

#### Scenario 3: Confirmation Flow

**Steps** (continuing from Scenario 2):
1. Click the confirmation checkbox

**Expected Results**:
- [x] Checkbox becomes checked
- [x] "Proceed with Unknown Asset" button becomes **ENABLED**
- [x] Button text is readable
- [x] Button has visible focus indicator when tabbed to

**Steps** (continuing):
2. Click the "Proceed with Unknown Asset" button

**Expected Results**:
- [x] Action proceeds (callback triggered, page advances if applicable)
- [x] No errors in console

#### Scenario 4: Lookalike Symbol Detection

**Setup**:
1. Create a resource with lookalike USDC (same symbol, different contract)
   - Contract: `CBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQ1`
   - Symbol: `USDC` (same as trusted USDC)

**Steps**:
1. Navigate to resource detail page
2. Observe payment requirement section

**Expected Results**:
- [x] Unknown asset warning is displayed (not suppressed by symbol match)
- [x] Contract address comparison shows:
  - **Requirement Contract**: `CBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQ1`
  - **Trusted Registry Entry**: USDC with original contract
  - **Mismatch Warning**: Red warning "Contract addresses do not match"
  - **Potential Lookalike Message**: "same symbol, different contract"
- [x] User must check confirmation checkbox to proceed
- [x] Symbol similarity does NOT bypass the warning

#### Scenario 5: Malformed Contract ID

**Setup**:
1. Create a resource with malformed contract ID
   - Contract: `INVALID_CONTRACT_ID`

**Steps**:
1. Navigate to resource detail page

**Expected Results**:
- [x] Error heading: "Invalid Asset Contract"
- [x] Error message: "invalid contract ID and cannot be processed"
- [x] Contract comparison section shows error state
- [x] **NO confirmation checkbox** is displayed
- [x] Message: "Please correct the contract ID and try again"
- [x] User cannot proceed until contract ID is fixed

#### Scenario 6: Copy-to-Clipboard

**Steps** (from unknown asset scenario):
1. Locate the "Copy" button near contract address
2. Click the copy button
3. Paste in a text field (Ctrl+V / Cmd+V)

**Expected Results**:
- [x] Button feedback: Title/tooltip changes to "Copied!"
- [x] Pasted text matches the full 56-character contract address exactly
- [x] After 2 seconds, feedback reverts to "Copy to clipboard"
- [x] Button remains accessible and clickable

### Desktop Testing (1024x768)

#### Steps:
1. Open browser to `http://localhost:3000/resources/[resource-id]`
2. Resize browser to 1024x768
3. Scroll to payment requirement section

#### Verification:
- [x] Full 56-character contract address is visible
- [x] No horizontal scrollbar appears
- [x] Warning card is fully visible
- [x] Checkbox and button are properly spaced
- [x] All text is readable (no overflow)
- [x] Layout is clean and professional

### Mobile Testing (375x667)

#### Steps:
1. Open browser DevTools (F12)
2. Toggle device emulation (Ctrl+Shift+M or Cmd+Shift+M)
3. Select "iPhone 12" or similar 375px viewport
4. Navigate to `/resources/[resource-id]`
5. Scroll to payment requirement section

#### Verification:
- [x] No horizontal scrollbar appears
- [x] Contract address wraps to multiple lines
- [x] All text is readable
- [x] Checkbox is easily clickable (large touch target)
- [x] Button spans full width or near-full width
- [x] Warning card is clearly visible
- [x] Spacing is appropriate for mobile

### Keyboard Navigation Testing

#### Setup:
1. Open resource detail page
2. Disable mouse (Tab through only)

#### Steps:
1. Press Tab to navigate through interactive elements
2. Expected order:
   - Skip link (if present)
   - Page heading
   - Navigation (if any)
   - Warning heading
   - Copy button (for contract address)
   - Confirmation checkbox
   - "Proceed with Unknown Asset" button
   - Other page elements

#### Verification:
- [x] All interactive elements are reachable via Tab
- [x] Tab order is logical and predictable
- [x] Focus indicators are visible on each element
- [x] Shift+Tab works in reverse
- [x] Space key toggles checkbox
- [x] Enter key activates buttons

#### Focus Management Test:
1. Load page with unknown asset
2. Immediately after page loads, focus should move to warning heading
3. Verify: Warning heading has focus border/indicator

### Screen Reader Testing

#### Using NVDA (Windows) or VoiceOver (Mac):

**Steps**:
1. Open resource with unknown asset
2. Turn on screen reader
3. Tab through the page

**Expected Announcements**:
- [x] "Heading level 3: Unknown Asset"
- [x] "Alert or Warning region" (if region role present)
- [x] Warning text is announced
- [x] "Checkbox: I understand this asset is not in the trusted registry. Not checked."
- [x] Description: "I have verified the contract address and proceed at my own risk."
- [x] "Button: Proceed with Unknown Asset. Disabled." (or "Enabled" after checking)
- [x] Contract address is announced (all 56 characters)
- [x] Copy button: "Button: Copy contract address"

**Verification**:
- [x] All critical information is announced
- [x] Form fields have accessible labels
- [x] Button states (enabled/disabled) are announced
- [x] No important information is hidden from screen readers

### Accessibility Checklist

- [x] Color is not the only visual indicator (warning uses icon + color + text)
- [x] Contrast ratios meet WCAG AA (4.5:1 for text, 3:1 for graphics)
- [x] Focus indicators are visible
- [x] Heading structure is correct (h1 → page title, h3 → warning)
- [x] Form fields have labels
- [x] Buttons have descriptive text
- [x] Interactive elements are keyboard-accessible
- [x] Page is navigable by keyboard alone

### Visual Regression Testing

#### Desktop Screenshots:
1. Unknown asset warning card
2. Contract address comparison (mismatch)
3. Confirmation checkbox and proceed button
4. Trusted asset display (green badge)

#### Mobile Screenshots:
1. Warning card layout on 375px viewport
2. Contract address wrapping
3. Full-width button

#### Steps:
1. Take screenshots of current implementation
2. Compare with baseline screenshots (if available)
3. Verify no unintended visual changes

## Test Data

### Fixtures

#### Testnet (stellar:testnet)

**Trusted Assets**:
- USDC: `CBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE`
- BRL: `CBQYB6MKFOPG7BWBT5H3KK43L2CQFWW5J2VJPWMVSWWFDMLZTFGZW7FY`

**Test Assets** (Unknown):
- Lookalike USDC: `CBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQ1`
- Generic Unknown: `CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC`

**Malformed** (Invalid):
- Invalid Format: `INVALID_CONTRACT_ID`
- Non-C Prefix: `GA7QYNF7SOWQ4VJNMGEVXZHYQACUIM2MRRPFNQ4SLRJRYE67Z2BJQXMR`
- Too Short: `CSHORT`

#### Pubnet (stellar:pubnet)

**Trusted Assets**:
- USDC: `CA7QYNF7SOWQ4VJNMGEVXZHYQACUIM2MRRPFNQ4SLRJRYE67Z2BJQXMR`

## Troubleshooting

### Tests Fail on TypeScript

**Issue**: "Type 'AssetTrustStatus' is not assignable..."

**Solution**:
1. Verify `src/services/api/asset-trust.ts` exports `AssetTrustStatus`
2. Run `pnpm typecheck` to see full error
3. Check imports in test files

### Tests Fail on Missing Component

**Issue**: "Cannot find module 'contract-address-comparison'"

**Solution**:
1. Verify file exists: `src/components/resources/contract-address-comparison.tsx`
2. Check import paths use correct casing
3. Verify file exports default or named export

### E2E Tests Timeout

**Issue**: "Timeout waiting for selector 'text=Unknown Asset'"

**Solution**:
1. Verify test resource exists and has unknown asset contract ID
2. Increase timeout: `page.waitForSelector(..., { timeout: 10000 })`
3. Check network tab in Playwright Inspector for failures
4. Verify resource is loading correctly

### Copy-to-Clipboard Fails

**Issue**: "clipboard.writeText is not a function"

**Solution**:
1. Test runs in secure context (HTTPS or localhost)
2. Browser grants clipboard permissions
3. Verify button click is reaching clipboard API

## Success Criteria

All tests should pass with the following criteria:

| Category | Metric | Target |
|----------|--------|--------|
| Unit Tests | Passing | 61/61 (100%) |
| Type Checking | Errors | 0 |
| Linting | Errors | 0 |
| E2E Tests | Passing | 100% |
| Desktop Responsive | No Overflow | ✓ |
| Mobile Responsive | No Horizontal Scroll | ✓ |
| Keyboard Navigation | All Elements Reachable | ✓ |
| Screen Reader | All Text Announced | ✓ |
| Accessibility | WCAG AA | ✓ |
| Security | No Secrets | ✓ |

## Reporting Issues

When reporting test failures:

1. **Unit Test Failures**:
   - Provide test name and assertion that failed
   - Include error message from test output
   - Provide relevant code snippet

2. **E2E Test Failures**:
   - Provide test name and step that failed
   - Include screenshot or video if available
   - Provide browser and OS version

3. **Manual Testing Issues**:
   - Describe expected vs. actual behavior
   - Provide steps to reproduce
   - Include browser and OS version
   - Provide screenshot or video if possible

## Sign-Off

Testing is complete when:

- [x] All 61 unit tests pass
- [x] TypeScript type checking passes (0 errors)
- [x] Linting passes (0 errors)
- [x] All E2E tests pass
- [x] Desktop viewport (1024x768) verified
- [x] Mobile viewport (375x667) verified
- [x] Keyboard navigation verified
- [x] Screen reader announcements verified
- [x] Accessibility checklist complete
- [x] Visual regression baseline captured
- [x] No regressions in existing functionality
- [x] Code review approved
- [x] Ready for merge

---

**Testing Completed By**: ________________  
**Date**: ________________  
**Result**: ✓ PASS / ✗ FAIL

