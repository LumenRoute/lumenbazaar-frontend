import { defineConfig, devices } from "@playwright/test";

/**
 * Production deployment connectivity configuration.
 * 
 * Targets a deployed frontend and backend to verify production connectivity
 * without cross-origin failures and to validate API schema compliance.
 * 
 * Environment variables:
 * - LUMENBAZAAR_PROD_FRONTEND_URL: Deployed frontend URL (required)
 *   Example: https://lumenbazaar.vercel.app
 * - LUMENBAZAAR_PROD_API_URL: Deployed backend API URL (optional, uses frontend env if not set)
 *   Example: https://api.testnet.lumenbazaar.example
 */

const frontendUrl = process.env.LUMENBAZAAR_PROD_FRONTEND_URL;
const apiUrl = process.env.LUMENBAZAAR_PROD_API_URL;

if (!frontendUrl) {
  throw new Error(
    "LUMENBAZAAR_PROD_FRONTEND_URL environment variable is required for production connectivity tests"
  );
}

export default defineConfig({
  expect: {
    timeout: 30_000
  },
  reporter: [["list"]],
  testDir: "./tests/e2e",
  timeout: 120_000,
  testMatch: "connectivity.spec.ts",
  use: {
    baseURL: frontendUrl,
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "prod-desktop",
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "prod-mobile",
      use: { ...devices["Pixel 7"] }
    }
  ]
});
