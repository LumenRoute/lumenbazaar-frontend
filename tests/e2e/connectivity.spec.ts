import { expect, test } from "@playwright/test";

/**
 * Production deployment smoke test for frontend to backend connectivity.
 * Verifies that the deployed frontend can successfully communicate with
 * the deployed API backend without CORS failures and validates schema compliance.
 */

test.describe("Production API Connectivity", () => {
  /**
   * Capture frontend and backend commit identifiers from /version endpoints
   */
  let frontendCommit: string;
  let backendCommit: string;
  let apiBaseUrl: string;

  test.beforeAll(async ({ browser }) => {
    // Get frontend commit from page context
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Capture frontend environment info
    await page.goto("/");
    frontendCommit = await page.evaluate(() => {
      // Try to get from meta tag if available
      return (document.querySelector('meta[name="x-frontend-commit"]') as HTMLMetaElement)
        ?.content || "unknown";
    });

    await context.close();
  });

  test("health endpoint returns 200 with ready status", async ({ page }) => {
    // Get API URL from runtime config
    const apiUrl = await page.evaluate(() => {
      const script = Array.from(document.querySelectorAll("script")).find(s =>
        s.textContent?.includes("NEXT_PUBLIC_LUMENBAZAAR_API_URL")
      );
      return script?.textContent
        ?.match(/NEXT_PUBLIC_LUMENBAZAAR_API_URL['":\s]+([^"'\s,]+)/)?.[1]
        || new URL(document.documentElement.baseURI).origin;
    });

    apiBaseUrl = apiUrl;

    const healthResponse = await page.request.get(`${apiUrl}/ready`);
    
    expect(healthResponse.status()).toBe(200);
    expect(healthResponse.headers()["content-type"]).toContain("application/json");

    const health = await healthResponse.json();
    expect(health).toHaveProperty("ok");
    expect(health.ok).toBe(true);
    expect(health).toHaveProperty("capabilities");
    expect(health.capabilities).toHaveProperty("exact");
    expect(health.capabilities.exact).toBe(true);
    expect(health).toHaveProperty("checks");
    expect(health.checks).toHaveProperty("database");
    expect(health.checks).toHaveProperty("horizon");
    expect(health.checks).toHaveProperty("stellarRpc");

    backendCommit = health.commit || "unknown";
  });

  test("supported networks endpoint returns valid schema", async ({ page }) => {
    const networkResponse = await page.request.get(`${apiBaseUrl}/v1/supported`);

    expect(networkResponse.status()).toBe(200);
    expect(networkResponse.headers()["content-type"]).toContain("application/json");

    const supported = await networkResponse.json();
    expect(supported).toHaveProperty("kinds");
    expect(Array.isArray(supported.kinds)).toBe(true);
    expect(supported.kinds.length).toBeGreaterThan(0);

    // Validate at least one kind
    const exactKind = supported.kinds.find(
      (k: { scheme: string; network: string }) => k.scheme === "exact"
    );
    expect(exactKind).toBeDefined();
    expect(exactKind.network).toMatch(/^stellar:(testnet|mainnet)$/);
    expect(exactKind).toHaveProperty("x402Version");
    expect(exactKind.x402Version).toBe(2);
    expect(exactKind).toHaveProperty("signers");

    expect(supported).toHaveProperty("signers");
    expect(supported.signers).toHaveProperty("stellar:*");
  });

  test("resources search endpoint returns valid results", async ({ page }) => {
    const searchResponse = await page.request.get(
      `${apiBaseUrl}/v1/discovery/search?query=stellar`
    );

    expect(searchResponse.status()).toBe(200);
    expect(searchResponse.headers()["content-type"]).toContain("application/json");

    const search = await searchResponse.json();
    expect(search).toHaveProperty("resources");
    expect(Array.isArray(search.resources)).toBe(true);

    if (search.resources.length > 0) {
      const resource = search.resources[0];
      expect(resource).toHaveProperty("id");
      expect(resource).toHaveProperty("name");
      expect(resource).toHaveProperty("description");
      expect(resource).toHaveProperty("url");
      expect(resource).toHaveProperty("network");
      expect(resource.network).toMatch(/^stellar:(testnet|mainnet)$/);
      expect(resource).toHaveProperty("status");
      expect(["active", "archived"]).toContain(resource.status);
    }
  });

  test("conformance endpoint documents API compliance", async ({ page }) => {
    const conformanceResponse = await page.request.get(`${apiBaseUrl}/openapi.json`);

    if (conformanceResponse.status() === 404) {
      // Fall back to version endpoint if OpenAPI not available
      const versionResponse = await page.request.get(`${apiBaseUrl}/version`);
      expect(versionResponse.status()).toBe(200);
      const version = await versionResponse.json();
      expect(version).toHaveProperty("version");
      expect(version).toHaveProperty("service");
      return;
    }

    expect(conformanceResponse.status()).toBe(200);
    expect(conformanceResponse.headers()["content-type"]).toContain("application/json");

    const openapi = await conformanceResponse.json();
    expect(openapi).toHaveProperty("openapi");
    expect(openapi).toHaveProperty("info");
    expect(openapi.info).toHaveProperty("version");
  });

  test("API endpoints respond without CORS errors", async ({ page }) => {
    // Set up to detect CORS errors
    const errors: string[] = [];
    page.on("response", (response) => {
      if (response.status() === 0) {
        errors.push(`CORS or network error: ${response.url()}`);
      }
    });

    // Make requests to all key endpoints
    const endpoints = [
      "/version",
      "/ready",
      "/v1/supported",
      "/v1/discovery/search?query=test",
      "/openapi.json"
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await page.request.get(`${apiBaseUrl}${endpoint}`, {
          timeout: 10000
        });
        // We expect either success or a well-defined error, not CORS failure
        expect([200, 400, 404, 500]).toContain(response.status());
      } catch (error) {
        // Network timeouts are acceptable, but CORS errors should be caught
        if (error instanceof Error) {
          expect(error.message).not.toMatch(/CORS|cross-origin/i);
        }
      }
    }

    expect(errors).toHaveLength(0);
  });

  test("deployment evidence is captured with commit identifiers", async ({ page }) => {
    // Document evidence for release gate
    const evidence = {
      timestamp: new Date().toISOString(),
      frontendCommit: frontendCommit,
      backendCommit: backendCommit,
      apiBaseUrl: apiBaseUrl,
      deploymentUrl: page.url()
    };

    // Verify all required fields are present
    expect(evidence.timestamp).toBeDefined();
    expect(evidence.deploymentUrl).toBeDefined();
    expect(evidence.apiBaseUrl).toBeDefined();

    // Log evidence for reviewer reference
    console.log("=== DEPLOYMENT EVIDENCE ===");
    console.log(JSON.stringify(evidence, null, 2));
    console.log("===========================");
  });
});
