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
  NEXT_PUBLIC_ENABLE_UPTO_SESSIONS: booleanFlagSchema,
  NEXT_PUBLIC_LUMENBAZAAR_API_URL: z.string().url().default("http://localhost:8080"),
  NEXT_PUBLIC_LUMENBAZAAR_DEFAULT_NETWORK: networkIdSchema.default("stellar:testnet"),
  NEXT_PUBLIC_LUMENBAZAAR_ENV: runtimeEnvironmentSchema.default("local")
});

export type RuntimeEnvironment = z.infer<typeof runtimeEnvironmentSchema>;

export type FeatureFlags = {
  enableMainnet: boolean;
  enableMcpInspector: boolean;
  enableUptoSessions: boolean;
};

export type RuntimeConfig = {
  apiBaseUrl: string;
  defaultNetwork: NetworkId;
  environment: RuntimeEnvironment;
  features: FeatureFlags;
  networks: typeof stellarNetworks;
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
      enableUptoSessions: parsed.data.NEXT_PUBLIC_ENABLE_UPTO_SESSIONS
    },
    networks: stellarNetworks
  };
}

function bundledPublicEnvironment() {
  return {
    NEXT_PUBLIC_ENABLE_MAINNET: process.env.NEXT_PUBLIC_ENABLE_MAINNET,
    NEXT_PUBLIC_ENABLE_MCP_INSPECTOR: process.env.NEXT_PUBLIC_ENABLE_MCP_INSPECTOR,
    NEXT_PUBLIC_ENABLE_UPTO_SESSIONS: process.env.NEXT_PUBLIC_ENABLE_UPTO_SESSIONS,
    NEXT_PUBLIC_LUMENBAZAAR_API_URL: process.env.NEXT_PUBLIC_LUMENBAZAAR_API_URL,
    NEXT_PUBLIC_LUMENBAZAAR_DEFAULT_NETWORK: process.env.NEXT_PUBLIC_LUMENBAZAAR_DEFAULT_NETWORK,
    NEXT_PUBLIC_LUMENBAZAAR_ENV: process.env.NEXT_PUBLIC_LUMENBAZAAR_ENV
  };
}

export function stripTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function isDemoMode(environment: RuntimeEnvironment = loadRuntimeConfig().environment) {
  return environment === "demo";
}
