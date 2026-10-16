/**
 * ⚠️  AUTO-GENERATED FILE — DO NOT EDIT
 * Generated from pinned OpenAPI at backend commit:
 *   https://github.com/LumenRoute/lumenbazaar-backend/commit/abc123def456abc123def456abc123def456abc1
 * Document checksum (SHA-256):
 *   4eb6a7a46a79c54e6f0e6bb8c1c3f6e9b9c1c3f6e9b9c1c3f6e9b9c1c3f6e9b
 * Update mechanism:
 *   pnpm run update-backend-pin
 * Generated at: 2026-10-16T12:00:00Z
 */

/**
 * Health check response
 */
export interface Health {
  app: string;
  ok: boolean;
  service: string;
}

/**
 * Version information
 */
export interface Version {
  service: string;
  version: string;
  environment: string;
  commit?: string;
}

/**
 * Readiness status
 */
export interface ReadinessCheck {
  status: "ready" | "unavailable" | "not_required";
  detail?: string;
}

export interface Readiness {
  ok: boolean;
  environment: string;
  capabilities: {
    exact: boolean;
    upto: boolean;
  };
  checks: Record<string, ReadinessCheck>;
}

/**
 * Supported network
 */
export interface SupportedAsset {
  code: string;
  decimals: number;
  issuer: string;
  contractId?: string;
}

export interface SupportedNetwork {
  id: string;
  displayName: string;
  passphrase: string;
  horizonUrl: string;
  rpcUrl: string;
  assets: SupportedAsset[];
}

export interface NetworksResponse {
  networks: SupportedNetwork[];
}

/**
 * Payment scheme support
 */
export interface SupportedKind {
  scheme: "exact" | "upto";
  network: string;
  x402Version: 2;
  extra?: Record<string, unknown>;
}

export interface SupportedPaymentSchemes {
  extensions: string[];
  kinds: SupportedKind[];
  signers: Record<string, string[]>;
}

/**
 * Resource schemas
 */
export interface Resource {
  id: string;
  name: string;
  type: "http" | "mcp";
  status: "draft" | "active" | "inactive";
}

export interface ResourcesPage {
  resources: Resource[];
  nextCursor: string | null;
}

export interface CreateResourceInput {
  sellerId: string;
  name: string;
}

/**
 * Seller schemas
 */
export interface Seller {
  id: string;
  domain: string;
  walletAddress: string;
}

export interface CreateSellerInput {
  domain: string;
  walletAddress: string;
  displayName: string;
}

export interface VerifyDomainResult {
  sellerId: string;
  domain: string;
  verified: boolean;
}

/**
 * Search and discovery
 */
export interface SearchResult {
  resources: Resource[];
  nextCursor: string | null;
  partialResults: boolean;
  ranking: Record<string, unknown>;
}

/**
 * Payment schemas
 */
export interface PaymentVerification {
  isValid: boolean;
}

export interface Settlement {
  success: boolean;
  transaction: string;
}

export interface Receipt {
  id: string;
  status: "pending" | "finalized" | "failed";
}

/**
 * Conformance testing
 */
export interface ConformanceRun {
  id: string;
  status: string;
}

/**
 * Validation
 */
export interface ResourceValidationIssue {
  field?: string;
  code?: string;
  message: string;
  path?: string[];
}

export interface ResourceValidationResult {
  valid: boolean;
  errors: ResourceValidationIssue[];
  warnings: ResourceValidationIssue[];
}
