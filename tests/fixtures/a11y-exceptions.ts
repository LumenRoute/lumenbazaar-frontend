/**
 * Accessibility exceptions framework.
 * Each exception requires:
 * - ruleId: axe rule ID (e.g., "color-contrast", "duplicate-id")
 * - route: the route path where the exception applies (e.g., "/playground")
 * - selector: CSS selector or brief description of the affected element
 * - reason: why this exception exists (e.g., "Third-party widget, planned for Q4 redesign")
 * - owner: team or person responsible for fixing (e.g., "@ui-team", "jane.doe@company.com")
 * - expiryDate: ISO 8601 date when this exception must be renewed or removed (e.g., "2026-12-31")
 *
 * The test harness validates:
 * - No expired exceptions (expiryDate < today → test fails)
 * - No stale exceptions (exception added but no violation found → test fails)
 * - All entries have owner and expiryDate (malformed → test fails)
 *
 * This prevents exception creep and forces regular review.
 */

export interface A11yException {
  ruleId: string;
  route: string;
  selector: string;
  reason: string;
  owner: string;
  expiryDate: string; // ISO 8601, e.g., "2026-12-31"
}

export const A11Y_EXCEPTIONS: A11yException[] = [
  // Example (commented out):
  // {
  //   ruleId: "color-contrast",
  //   route: "/playground",
  //   selector: ".data-mode-badge",
  //   reason: "Demo badge styling, low contrast by design. Planned for Q4 2026 redesign.",
  //   owner: "@ui-team",
  //   expiryDate: "2026-12-31"
  // }
];

/**
 * Get exceptions for a specific route.
 */
export function getExceptionsForRoute(route: string): A11yException[] {
  return A11Y_EXCEPTIONS.filter((exc) => exc.route === route);
}

/**
 * Validate exceptions framework:
 * - No expired dates
 * - All entries have owner and expiryDate
 * - No missing fields
 */
export function validateExceptions(): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const today = new Date().toISOString().split("T")[0];

  for (let i = 0; i < A11Y_EXCEPTIONS.length; i++) {
    const exc = A11Y_EXCEPTIONS[i];

    // Check all required fields
    if (!exc.ruleId) errors.push(`Exception ${i}: missing ruleId`);
    if (!exc.route) errors.push(`Exception ${i}: missing route`);
    if (!exc.selector) errors.push(`Exception ${i}: missing selector`);
    if (!exc.reason) errors.push(`Exception ${i}: missing reason`);
    if (!exc.owner) errors.push(`Exception ${i}: missing owner`);
    if (!exc.expiryDate) errors.push(`Exception ${i}: missing expiryDate`);

    // Check expiry date is in future
    if (exc.expiryDate && exc.expiryDate < today) {
      errors.push(`Exception ${i} (${exc.ruleId} on ${exc.route}): expired (${exc.expiryDate} < ${today})`);
    }

    // Check date format is ISO 8601
    if (exc.expiryDate && !/^\d{4}-\d{2}-\d{2}$/.test(exc.expiryDate)) {
      errors.push(`Exception ${i}: invalid date format (use ISO 8601: YYYY-MM-DD)`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
