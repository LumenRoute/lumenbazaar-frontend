/**
 * Type definitions for privacy-safe telemetry system.
 * All telemetry events must use types defined here and conform to the allowlist.
 */

import type { NetworkId } from "@/config/networks";

/**
 * Closed set of telemetry events. New events require design review.
 */
export type TelemetryEventType =
  | "wallet_connect_attempt"
  | "wallet_connect_success"
  | "payment_verification_attempted"
  | "payment_verification_succeeded"
  | "payment_verification_failed"
  | "payment_authorization_initiated"
  | "payment_authorized"
  | "payment_authorization_failed"
  | "resource_fetch_attempted"
  | "resource_fetch_succeeded"
  | "resource_fetch_failed"
  | "settlement_initiated"
  | "settlement_completed"
  | "settlement_failed"
  | "ui_error_displayed"
  | "app_initialized";

/**
 * Bounded set of wallet connection error codes.
 */
export type WalletErrorCode =
  | "WALLET_REJECTED"
  | "WALLET_TIMEOUT"
  | "WALLET_UNAVAILABLE"
  | "SIGNATURE_INVALID"
  | "WALLET_NETWORK_MISMATCH";

/**
 * Bounded set of error categories for payment and resource operations.
 */
export type ErrorCategory =
  | "INVALID_SIGNATURE"
  | "VERIFICATION_TIMEOUT"
  | "VERIFICATION_FAILED"
  | "NETWORK_ERROR"
  | "RESOURCE_TIMEOUT"
  | "RESOURCE_FETCH_FAILED"
  | "SETTLEMENT_FAILED"
  | "UNKNOWN_ERROR";

/**
 * Bounded resource type enum.
 */
export type ResourceType = "service" | "data";

/**
 * Bounded consent status enum.
 */
export type ConsentStatus = "enabled" | "disabled_by_config" | "disabled_by_consent" | "no_consent_given";

/**
 * Common telemetry context included with every event.
 */
export type TelemetryContext = {
  deploymentId?: string; // optional; hash of API endpoint for correlation across deployments
  sessionId: string; // opaque session identifier (non-wallet-specific)
  networkId: NetworkId; // stellar:testnet or stellar:pubnet
};

/**
 * Event-specific payload type unions. Only allowlisted fields per event type.
 */
export type TelemetryEventData = 
  | { type: "wallet_connect_attempt"; status: "initiated"; errorCode?: WalletErrorCode | null }
  | { type: "wallet_connect_success" }
  | { type: "payment_verification_attempted"; resourceType: ResourceType; assetCode: string }
  | { type: "payment_verification_succeeded"; duration_ms: number }
  | { type: "payment_verification_failed"; errorCategory: ErrorCategory; duration_ms: number }
  | { type: "payment_authorization_initiated" }
  | { type: "payment_authorized"; duration_ms: number }
  | { type: "payment_authorization_failed"; errorCategory: ErrorCategory; duration_ms: number }
  | { type: "resource_fetch_attempted"; resourceType: ResourceType }
  | { type: "resource_fetch_succeeded"; duration_ms: number }
  | { type: "resource_fetch_failed"; errorCategory: ErrorCategory; duration_ms: number }
  | { type: "settlement_initiated" }
  | { type: "settlement_completed"; duration_ms: number }
  | { type: "settlement_failed"; errorCategory: ErrorCategory; duration_ms: number }
  | { type: "ui_error_displayed"; errorCategory: ErrorCategory; source: string }
  | { type: "app_initialized"; telemetryEnabled: boolean; consentStatus: ConsentStatus };

/**
 * Complete telemetry event structure. All events routed through TelemetryService.
 */
export type TelemetryEvent = {
  timestamp: number; // milliseconds since epoch
  eventType: TelemetryEventType;
  context: TelemetryContext;
  data: TelemetryEventData & { type: TelemetryEventType };
};

/**
 * Telemetry service interface for validation and emission.
 */
export interface TelemetryService {
  /**
   * Validate and emit an event. Returns true if accepted and sent, false if rejected or disabled.
   */
  emit(event: Omit<TelemetryEvent, "timestamp">): boolean;

  /**
   * Check if telemetry is currently enabled.
   */
  isEnabled(): boolean;

  /**
   * Immediately disable telemetry (e.g., user withdrawal of consent).
   */
  disable(): void;

  /**
   * Optional: retrieve collected events for testing/inspection.
   */
  getCollectedEvents?(): TelemetryEvent[];
}

/**
 * Telemetry sink interface for emission targets (no-op, console, remote, etc.).
 * Implementations should not perform validation; they receive pre-validated events.
 */
export interface TelemetrySink {
  /**
   * Send a validated event to the sink.
   */
  send(event: TelemetryEvent): void;
}

/**
 * Configuration for telemetry service initialization.
 */
export type TelemetryConfig = {
  enabled: boolean; // from NEXT_PUBLIC_ENABLE_TELEMETRY env var
  consentStatus: ConsentStatus; // from storage or defaults
  networkId: NetworkId;
  deploymentId?: string;
  sink: TelemetrySink;
};
