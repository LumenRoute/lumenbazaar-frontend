import { z } from "zod";

import { networkIdSchema, stellarNetworks, type NetworkId } from "./networks";

const runtimeEnvironmentSchema = z.enum(["demo", "local", "testnet", "mainnet"]);

const booleanFlagSchema = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const rawPublicEnvSchema = z.object({
  NEXT_PUBLIC_ENABLE_MAINNET: booleanFlagSchema,
  NEXT_PUBLIC_ENABLE_MCP_INSPECTOR: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  NEXT_PUBLIC_ENABLE_TELEMETRY: booleanFlagSchema,
  NEXT_PUBLIC_ENABLE_UPTO_SESSIONS: booleanFlagSchema,
  NEXT_PUBLIC_LUMENBAZAAR_API_URL: z.string().url().default("http://localhost:8080"),
  NEXT_PUBLIC_LUMENBAZAAR_DEFAULT_NETWORK: networkIdSchema.default("stellar:testnet"),
  NEXT_PUBLIC_LUMENBAZAAR_ENV: runtimeEnvironmentSchema.default("local"),
  NEXT_PUBLIC_LUMENBAZAAR_TRUSTED_ORIGINS: z.string().default("")
});

export type RuntimeEnvironment = z.infer<typeof runtimeEnvironmentSchema>;

export type FeatureFlags = {
  enableMainnet: boolean;
  enableMcpInspector: boolean;
  enableTelemetry: boolean;
  enableUptoSessions: boolean;
};

export type RuntimeConfig = {
  apiBaseUrl: string;
  defaultNetwork: NetworkId;
  environment: RuntimeEnvironment;
  features: FeatureFlags;
  networks: NetworkId[];
  /** Extra https origins allowed by the Content Security Policy connect-src. */
  trustedOrigins: string[];
};

export function loadRuntimeConfig(
  env: Record<string, string | undefined> = bundledPublicEnvironment()
): RuntimeConfig {
  const parsed = rawPublicEnvSchema.safeParse(env);

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid LumenBazaar frontend configuration: ${issues.join("; ")}`);
  }

  if (
    parsed.data.NEXT_PUBLIC_LUMENBAZAAR_DEFAULT_NETWORK === "stellar:pubnet" &&
    !parsed.data.NEXT_PUBLIC_ENABLE_MAINNET
  ) {
    throw new Error(
      "Invalid LumenBazaar frontend configuration: stellar:pubnet requires NEXT_PUBLIC_ENABLE_MAINNET=true"
    );
  }

  return {
    apiBaseUrl: stripTrailingSlash(parsed.data.NEXT_PUBLIC_LUMENBAZAAR_API_URL),
    defaultNetwork: parsed.data.NEXT_PUBLIC_LUMENBAZAAR_DEFAULT_NETWORK,
    environment: parsed.data.NEXT_PUBLIC_LUMENBAZAAR_ENV,
    features: {
      enableMainnet: parsed.data.NEXT_PUBLIC_ENABLE_MAINNET,
      enableMcpInspector: parsed.data.NEXT_PUBLIC_ENABLE_MCP_INSPECTOR,
      enableTelemetry: parsed.data.NEXT_PUBLIC_ENABLE_TELEMETRY,
      enableUptoSessions: parsed.data.NEXT_PUBLIC_ENABLE_UPTO_SESSIONS
    },
    networks: resolveEnabledNetworks(parsed.data.NEXT_PUBLIC_ENABLE_MAINNET),
    trustedOrigins: parseTrustedOrigins(parsed.data.NEXT_PUBLIC_LUMENBAZAAR_TRUSTED_ORIGINS)
  };
}

/**
 * Derives the selectable networks from runtime feature configuration so that
 * stellar:pubnet is never exposed while mainnet is disabled.
 */
export function resolveEnabledNetworks(enableMainnet: boolean): NetworkId[] {
  return stellarNetworks.filter((network) => network !== "stellar:pubnet" || enableMainnet);
}

function bundledPublicEnvironment() {
  return {
    NEXT_PUBLIC_ENABLE_MAINNET: process.env.NEXT_PUBLIC_ENABLE_MAINNET,
    NEXT_PUBLIC_ENABLE_MCP_INSPECTOR: process.env.NEXT_PUBLIC_ENABLE_MCP_INSPECTOR,
    NEXT_PUBLIC_ENABLE_TELEMETRY: process.env.NEXT_PUBLIC_ENABLE_TELEMETRY,
    NEXT_PUBLIC_ENABLE_UPTO_SESSIONS: process.env.NEXT_PUBLIC_ENABLE_UPTO_SESSIONS,
    NEXT_PUBLIC_LUMENBAZAAR_API_URL: process.env.NEXT_PUBLIC_LUMENBAZAAR_API_URL,
    NEXT_PUBLIC_LUMENBAZAAR_DEFAULT_NETWORK: process.env.NEXT_PUBLIC_LUMENBAZAAR_DEFAULT_NETWORK,
    NEXT_PUBLIC_LUMENBAZAAR_ENV: process.env.NEXT_PUBLIC_LUMENBAZAAR_ENV,
    NEXT_PUBLIC_LUMENBAZAAR_TRUSTED_ORIGINS: process.env.NEXT_PUBLIC_LUMENBAZAAR_TRUSTED_ORIGINS
  };
}

/**
 * Parses the comma-separated CSP allowlist. Each entry must be a bare https
 * origin (http is accepted only for loopback development hosts). Wildcards,
 * paths, credentials, and query strings fail closed instead of silently
 * widening the policy.
 */
export function parseTrustedOrigins(value: string): string[] {
  const origins = new Set<string>();

  for (const entry of value.split(",")) {
    const candidate = entry.trim();
    if (candidate === "") continue;

    if (candidate.includes("*")) {
      throw new Error(
        `Invalid LumenBazaar frontend configuration: wildcard CSP origins are not allowed (${candidate})`
      );
    }

    let url: URL;
    try {
      url = new URL(candidate);
    } catch {
      throw new Error(
        `Invalid LumenBazaar frontend configuration: malformed CSP origin (${candidate})`
      );
    }

    const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    const allowedProtocol = url.protocol === "https:" || (loopback && url.protocol === "http:");
    const bareOrigin = url.pathname === "/" && url.search === "" && url.hash === "";

    if (!allowedProtocol || !bareOrigin || url.username !== "" || url.password !== "") {
      throw new Error(
        `Invalid LumenBazaar frontend configuration: untrusted CSP origin (${candidate})`
      );
    }

    origins.add(url.origin);
  }

  return [...origins];
}

export function stripTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function isDemoMode(environment: RuntimeEnvironment = loadRuntimeConfig().environment) {
  return environment === "demo";
}
