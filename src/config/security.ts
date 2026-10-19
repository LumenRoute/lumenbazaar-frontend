import type { RuntimeConfig } from "./runtime";

export type SecurityHeader = {
  key: string;
  value: string;
};

const sharedConnectSourceProtocols = new Set(["https:"]);

/**
 * Builds the content security policy for wallet and payment pages.
 *
 * `connect-src` is derived only from configured service origins: the backend
 * API, the selected network's Soroban RPC and Horizon endpoints, and any
 * explicitly trusted origins. Wildcards are rejected while the config loads.
 *
 * `'unsafe-inline'` in `script-src` is required by the Next.js App Router
 * hydration/bootstrap scripts because this app does not use nonces. `eval` is
 * never allowed, and no wallet or docs wildcard is added implicitly. Additional
 * wallet/docs origins must be declared in
 * NEXT_PUBLIC_LUMENBAZAAR_TRUSTED_ORIGINS.
 */
export function buildContentSecurityPolicy(config: RuntimeConfig): string {
  const network = config.networks[config.defaultNetwork];
  const connectSources = new Set([
    "'self'",
    originOf(config.apiBaseUrl),
    originOf(network.rpcUrl),
    originOf(network.horizonUrl),
    ...config.trustedOrigins
  ]);

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${[...connectSources].join(" ")}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'"
  ].join("; ");
}

export function buildSecurityHeaders(
  config: RuntimeConfig,
  options: { production?: boolean } = {}
): SecurityHeader[] {
  const production = options.production ?? process.env.NODE_ENV === "production";
  const headers: SecurityHeader[] = [
    { key: "Content-Security-Policy", value: buildContentSecurityPolicy(config) },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(), payment=()" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-DNS-Prefetch-Control", value: "off" },
    { key: "X-Frame-Options", value: "DENY" }
  ];

  if (production) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload"
    });
  }

  return headers;
}

export function isTrustedConnectOrigin(value: string) {
  try {
    const url = new URL(value);
    return (
      sharedConnectSourceProtocols.has(url.protocol) ||
      (url.protocol === "http:" && isLoopbackHost(url.hostname))
    );
  } catch {
    return false;
  }
}

function originOf(value: string) {
  const url = new URL(value);

  if (!isTrustedConnectOrigin(value)) {
    throw new Error(
      `Refusing to add an untrusted connect-src origin to the Content Security Policy: ${url.origin}`
    );
  }

  return url.origin;
}

function isLoopbackHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}
