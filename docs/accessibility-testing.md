# Accessibility Testing Guide

This document explains how to run, maintain, and extend automated accessibility testing in LumenBazaar.

## Overview

Automated accessibility testing helps catch common WCAG 2.x Tevel A & AA violations early:

- Missing or incorrect landmarks (main, nav, header, footer)
- Heading hierarchy issues (skipped levels, multiple h1s)
- Color contrast problems
- Missing ARIA labels and roles
- Focus management and keyboard navigation issues
- Live region announcements (loading, error, success states)

**Important**: Automated scans are a first line of defense. They do not replace:

-  Manual accessibility review with assistive technologies (screen readers, keyboard navigation)
-  Expert WCAG conformance audits
-  User testing with people with disabilities

## Running Tests Locally

### Run all a11y checks (desktop + mobile)

```bash
pnpm test:e2e:a11y
```

This runs both:
- Shared assertion checks (landmarks, headings, focus order, etc.)
- Axe-core scans for WCAG violations

### Run focused wallet/payment a11y coverage

```bash
pnpm exec playwright test wallet-a11y.spec.ts
```

This covers keyboard operability of wallet connect/disconnect controls, live region announcements for wallet and receipt states, focus indicators, and reduced-motion behavior.

### Run specific route

```bash
pnpm exec playwright test a11y.spec.ts -g "Dashboard"
```

### Run only desktop

```bash
pnpm exec playwright test a11y.spec.ts --project=desktop
```

### Run only mobile

```bash
pnpm exec playwright test a11y.spec.ts --project=mobile
```

### Run with verbose output

```bash
pnpm exec playwright test a11y.spec.ts --reporter=verbose
```

## Test Structure

### Files

- **`tests/e2e/a11y.spec.ts`** — Main Playwright test suite that scans all routes
- **`tests/e2e/wallet-a11y.spec.ts`** — Focused wallet/payment flow accessibility coverage
- **`tests/fixtures/routes.ts`** — Central inventory of primary routes and coverage guard
- **`tests/fixtures/accessibility.ts`** — Shared accessibility assertions
- **`tests/fixtures/a11y-exceptions.ts`** — Known exceptions with expiry dates
- **`tests/unit/a11y-exceptions.test.ts`** — Vitest suite validating exceptions framework
- **`tests/unit/routes.test.ts`** — Vitest suite validating route coverage
- **`docs/accessibility-testing.md`** — This file

### What Gets Tested

#### Shared Assertions (Every Route)

Every route is checked for:

1. **Landmarks**: Exactly one `<main>e landmark; consistent header/nav/footer
2. **Navigation**: If multiple `<nav>` elements, each must have unique `aria-label`
3. **Skip Link**: A keyboard-accessible link to skip to main content
4. **Headings**: Exactly one `<h1>` per route; no skipped levels (h1 → h3 is invalid)
5. **Focus Order**: Logical tab order; visible focus indicator on first interactive element
6. **Live Regions**: Status/alert announcements (`role="status"`, `role="alert"`, `aria-live`) for loading/error/success states

#### Axe-Core Scan (Every Route)

Automated scan for WCAG 2.x Tevel A & AA violations, including:
- Color contrast (4.5:1 for normal text, 3:1 for large text)
- ARIA attributes and roles
-  Form labels and inputs
- Alt text for images
-  Link purposes
- And 90+ more rules

#### Wallet and Payment Flows (Focused Coverage)

The wallet status component and receipt detail page are covered by `tests/e2e/wallet-a11y.spec.ts`:

- Wallet connect/disconnect controls are focusable and operable via keyboard (Enter/Space).
- Wallet status changes (connecting, connected, mismatch, error) are announced through a polite live region - focus is not moved away from the triggering control.
- Receipt error states are announced through an assertive alert region.
- Reduced-motion preferences are respected (animation duration is zero).
- Contrast of wallet badges and status text is validated by axe-core.

## Adding a New Route

When you add a new page to the app:

1. **Add to `PRIMARY_ROUTES`** in `tests/fixtures/routes.ts`:

   ```typescript
   export const PRIMARY_ROUTES: PrimaryRoute[] = [
     // ... existing routes
     { path: "/new-page", name: "New Page" }
   ];
   ```

2. **Run the a11y tests**:

   ```bash
   pnpm test:e2e:a11y
   ```

3. **If violations are found**:

   - **Option A: Fix the defect** (preferred)
     - Ensure one `<main>` landmark
     - Provide proper `aria-label` for nav/regions
     - Use semantic HTML (`<header>`, `<nav>`, `<h1>`, etc.)
     - Ensure sufficient color contrast
     - Add ARIA labels where needed

   - **Option B: Document an exception** (for known issues)
     - See "Adding/Renewing Exceptions" below
     - Only for temporary issues with clear remediation plan

4. **Tests should pass**:

   ```bash
   pnpm test:e2e:a11y
   ```

## Adding/Renewing Exceptions

Exceptions are for known, documented accessibility issues that:
- Have a clear owner and remediation plan
- Expire by a specific date (forcing review/renewal)
- Are specific to a rule, route, and selector

### Create Exception

Edit `tests/fixtures/a11y-exceptions.ts`:

```typescript
export const A11Y_EXCEPTIONS: A11yException[] = [
  {
    ruleId: "color-contrast",          // Axe rule ID
    route: "/playground",              // Where the issue is
    selector: ".data-mode-badge",      // CSS selector or description
    reason: "Placeholder badge styling for demo. Redesign planned Q4 2026.",
    owner: "@ui-team",                 // Responsible party
    expiryDate: "2026-12-31"          // ISO 8601 date (YYYY-MM-DD)
  }
];
```

### Find Axe Rule IDs

When a test fails, look for the rule ID in the error message:

```
Rule: color-contrast
Impact: serious
Color: Elements must have sufficient color contrast...
```

Or consult [Axe Rules Documentation](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md).

### Validate Exceptions

Exceptions are automatically validated:

```bash
pnpm test
```

This runs `tests/unit/a11y-exceptions.test.ts`, which checks:
- No expired dates (expiryDate < today → test fails)
- No stale exceptions (exception added but no violation found → test fails)
- All required fields present (owner, expiryDate, reason)
- Date format is ISO 8601 (YYYY-MM-DD)

### Renewing Exceptions

The exception approaches or passes its expiry date:

1. Fix the underlying accessibility issue, OR
2. Update the `expiryDate` to a future date and explain why in `reason`

Example renewal:

```typescript
{
  ruleId: "color-contrast",
  route: "/playground",
  selector: ".data-mode-badge",
  reason: "Placeholder styling. Q4 2026 redesign delayed to Q1 2027. Renewed until 2027-03-31.",
  owner: "@ui-team",
  expiryDate: "2027-03-31"  // Extended expiry
}
```

## CI Integration

Accessibility tests run automatically on every pull request:

```yaml
# .github/workflows/ci.yml
- name: Run accessibility tests
  run: pnpm test:e2e:a11y
```

Tests run on both **desktop (Chrome)** and **mobile (Pixel 7)** viewports.

To see CI results:
1. Push your branch
2. GitHub Actions runs `pnpm test:e2e:a11y`
3. Check the PR checks for a11y test results

## Troubleshooting

### Test fails with "violation found"

Look at the violation details in the error message:

```
Accessibility violations found on /playground:
  Rule: color-contrast
  Impact: serious
  Description: Elements must have sufficient color contrast...
```

**Fix**:
1. Use browser DevTools to locate the element (use the selector if provided)
2. Check background/foreground colors
3. Adjust CSS to meet 4.5:1 ratio (normal text) or 3:1 (large text)
4. Re-run test

### Test fails with "exception is stale"

This means you added an exception for a violation that no longer exists.

**Fix**:
1. Remove the exception from `tests/fixtures/a11y-exceptions.ts`
2. Re-run test

### Test fails with "exception is expired"

The expiry date has passed.

**Fix**:
1. Either remove the exception (fix complete) or update the expiry date with a new target date
2. Update the `reason` to explain the delay
3. Re-run test

### Test times out

The test might be waiting for a network request that's unavailable. Demo mode fixtures are used by default; live APIs are not queried.

**Fix**:
1. Check if the route requires login or specific state
2. Add setup/fixture data to `PRIMARY_ROUTES` if needed
3. Or skip the route with a documented reason in `PRIMARY_ROUTES`

## Accessibility Checklist for New Features

When adding a new page or feature:

- [ ] Use semantic HTML (`<header>`, `<nav>`, `<main>`, `<footer>`)
- [ ] One `<h1>` per page; logical heading hierarchy (no skips)
- [ ] All images have descriptive `alt` text
- [ ] Form inputs have associated `<label>` elements
- [ ] Interactive elements are keyboard accessible (focusable, proper tab order)
- [ ] Focus indicator is visible (CSS `:focus-visible`)
- [ ] Color is not the only means of conveying information (use icons, text, etc.)
- [ ] Text color contrast is at least 4.5:1 (normal) or 3:1 (large)
- [ ] Status/error/success messages use live regions (`role="status"`, `aria-live`)
- [ ] Skip link allows keyboard navigation to main content
- [ ] Test with keyboard only (Tab, Shift+Tab, Enter, Space, Arrow keys)
- [ ] Test with a screen reader (NVDA on Windows, VoiceOver on macOS, JAWS for advanced)

## Manual Keyboard Evidence

For payment and wallet flows, record the following manual checks in your PR description:

1. **Tab order**: Tab through the wallet connect button, status badge, and disconnect button. Confirm order matches visual layout.
2. **Activation**: Press Enter and Space on the connect button. Confirm connection state changes and focus remains on the control.
3. **Announcement**: With a screen reader active, connect and disconnect. Confirm the status live region reads the new state without moving focus.
4. **Error state**: Navigate to a synthetic receipt ID that fails. Confirm the alert role reads the error and the retry button is reachable by keyboard.
5. **Reduced motion**: Enable the OS reduced-motion setting and confirm no animations play in wallet status transitions.

## Resources

- [WCAG 2.1 Overview](https://www.w3.org/WAI/WCAG21/quickref/)
-  [Axe Rules](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
-  [WebAIM Articles](https://webaim.org/articles/)
-  [Deque's Accessibility Resources](https://www.deque.com/resources/)

## Questions?

Consult:
1. This guide and linked resources
2. Existing tests and comments in `tests/e2e/a11y.spec.ts`
3. GitHub Issues tagged with `accessibility` or `a11y`
4. Reach out to the accessibility/frontend team
