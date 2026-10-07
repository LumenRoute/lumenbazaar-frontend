import { describe, expect, it } from "vitest";

import { loadRuntimeConfig, stripTrailingSlash } from "./runtime";

describe("runtime configuration", () => {
  it("defaults to local testnet configuration", () => {
    const config = loadRuntimeConfig({});

    expect(config.environment).toBe("local");
    expect(config.defaultNetwork).toBe("stellar:testnet");
    expect(config.apiBaseUrl).toBe("http://localhost:8080");
    expect(config.features.enableMainnet).toBe(false);
  });

  it("requires demo mode to be selected explicitly", () => {
    expect(loadRuntimeConfig({}).environment).toBe("local");
    expect(
      loadRuntimeConfig({
        NEXT_PUBLIC_LUMENBAZAAR_ENV: "demo"
      }).environment
    ).toBe("demo");
  });

  it("rejects malformed facilitator URLs", () => {
    expect(() =>
      loadRuntimeConfig({
        NEXT_PUBLIC_LUMENBAZAAR_API_URL: "not a url"
      })
    ).toThrow("Invalid LumenBazaar frontend configuration");
  });

  it("keeps pubnet disabled until the mainnet flag is explicit", () => {
    expect(() =>
      loadRuntimeConfig({
        NEXT_PUBLIC_LUMENBAZAAR_DEFAULT_NETWORK: "stellar:pubnet"
      })
    ).toThrow("stellar:pubnet requires NEXT_PUBLIC_ENABLE_MAINNET=true");
  });

  it("normalizes API URLs for request construction", () => {
    expect(stripTrailingSlash("https://api.example.test/")).toBe("https://api.example.test");
  });
});
