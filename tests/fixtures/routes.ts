/**
 * Central inventory of primary routes for accessibility testing coverage.
 * Every primary route must be listed here or explicitly excluded with a reason, owner, and expiry.
 * A test validates that no route exists in src/app without being accounted for in this list.
 */

export interface PrimaryRoute {
  path: string;
  name: string;
  /** Optional: 'all' (default) | 'desktop' | 'mobile' */
  platforms?: string[];
  /** Optional: if this route should be skipped from a11y scan */
  skip?: {
    reason: string;
    owner: string;
    expiry?: string; // ISO 8601 date
  };
}

export const PRIMARY_ROUTES: PrimaryRoute[] = [
  // Navigation & Discovery
  { path: "/", name: "Dashboard" },
  { path: "/explore", name: "Explore" },

  // Seller
  { path: "/seller", name: "Seller Dashboard" },
  { path: "/seller/new-resource", name: "Seller - New Resource" },
  { path: "/seller/resources", name: "Seller - Resources" },
  { path: "/seller/payments", name: "Seller - Payments" },

  // Operators
  { path: "/operators", name: "Operators Dashboard" },
  { path: "/operators/health", name: "Operators - Health" },
  { path: "/operators/conformance", name: "Operators - Conformance" },

  // Settings & Account
  { path: "/settings", name: "Settings" },

  // Documentation & Resources
  { path: "/docs", name: "Documentation" },
  { path: "/resources/resource_weather_api", name: "Resource Detail" },

  // Payment & Transactions
  { path: "/playground", name: "Payment Playground" },
  { path: "/transactions", name: "Transactions" },
  { path: "/receipts/receipt_weather_001", name: "Receipt Detail" }
];

/**
 * Routes that are excluded from primary a11y testing coverage.
 * Each exclusion must include a reason, owner, and expiry date.
 */
export const EXCLUDED_ROUTES: Array<{
  pattern: string; // glob or exact path
  reason: string;
  owner: string;
  expiry: string; // ISO 8601 date
}> = [
  // Example: exclude dynamic catchall routes that can't be tested without specific data
  // { pattern: "/receipts/[receiptId]", reason: "Dynamic route, tested via /receipts/receipt_weather_001", owner: "@a11y-team", expiry: "2027-01-01" }
];
