import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";
import { loadRuntimeConfig } from "./runtime";
import { buildContentSecurityPolicy, buildSecurityHeaders } from "./security";

const trustedEnv = {
  NEXT_PUBLIC_LUMENBAZAAR_API_URL: "https://api.lumenbazaar.example",
  NEXT_PUBLIC_LUMENBAZAAR_TRUSTED_ORIGINS: "https://docs.stellar.org, https://wallet.example"
};

describe("content security policy", () => {
  it("derives connect-src only from configured service origins", () => {
    const csp = buildContentSecurityPolicy(loadRuntimeConfig(trustedEnv));
    const connectSrc = directive(csp, "connect-src");

    expect(connectSrc).toContain("'self'");
    expect(connectSrc).toContain("https://api.lumenbazaar.example");
    expect(connectSrc).toContain("https://soroban-testnet.stellar.org");
    expect(connectSrc).toContain("https://horizon-testnet.stellar.org");
    expect(connectSrc).toContain("https://docs.stellar.org");
    expect(connectSrc).toContain("https://wallet.example");
    expect(connectSrc).not.toContain("*");
    expect(connectSrc).not.toContain("https://attacker.example");
  });

  it("rejects wildcard and untrusted trusted-origin configuration", () => {
    expect(() =>
      loadRuntimeConfig({ ...trustedEnv, NEXT_PUBLIC_LUMENBAZAAR_TRUSTED_ORIGINS: "*" })
    ).toThrow("wildcard CSP origins are not allowed");
    expect(() =>
      loadRuntimeConfig({
        ...trustedEnv,
        NEXT_PUBLIC_LUMENBAZAAR_TRUSTED_ORIGINS: "http://api.example.com"
      })
    ).toThrow("untrusted CSP origin");
    expect(() =>
      loadRuntimeConfig({
        ...trustedEnv,
        NEXT_PUBLIC_LUMENBAZAAR_TRUSTED_ORIGINS: "https://docs.example/path"
      })
    ).toThrow("untrusted CSP origin");
  });

  it("keeps frame protections and avoids broad unsafe-eval expansion", () => {
    const csp = buildContentSecurityPolicy(loadRuntimeConfig(trustedEnv));

    expect(directive(csp, "frame-ancestors")).toBe("'none'");
    expect(directive(csp, "frame-src")).toBe("'none'");
    expect(directive(csp, "object-src")).toBe("'none'");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("emits the documented security headers for every route", async () => {
    const entries = await nextConfig.headers?.();
    const headers = new Map(entries?.[0]?.headers.map(({ key, value }) => [key, value]));

    expect(entries?.[0]?.source).toBe("/:path*");
    expect(headers.get("Content-Security-Policy")).toContain("default-src 'self'");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("Permissions-Policy")).toContain("camera=()");
  });

  it("adds HSTS only for production responses", () => {
    const config = loadRuntimeConfig(trustedEnv);
    const development = new Map(
      buildSecurityHeaders(config, { production: false }).map(({ key, value }) => [key, value])
    );
    const production = new Map(
      buildSecurityHeaders(config, { production: true }).map(({ key, value }) => [key, value])
    );

    expect(development.has("Strict-Transport-Security")).toBe(false);
    expect(production.get("Strict-Transport-Security")).toContain("max-age=63072000");
  });
});

function directive(csp: string, name: string) {
  return csp
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${name} `))
    ?.slice(name.length + 1);
}
