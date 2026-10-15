/**
 * Core telemetry service.
 * Central point for all telemetry events: validation, redaction, emission.
 */

import {
  EVENT_ALLOWLIST,
  MAX_EVENT_PAYLOAD_SIZE,
  validateFieldBound,
  isFieldAllowed,
  getAllowedFields
} from "./allowlist";
import { containsSensitiveData, createSensitiveDataRejectionDiagnostic } from "./redaction";
import type {
  TelemetryService,
  TelemetryEvent,
  TelemetryConfig,
  TelemetryEventType
} from "./types";

/**
 * Default TelemetryService implementation.
 * Handles validation, redaction, and emission of telemetry events.
 */
export class DefaultTelemetryService implements TelemetryService {
  private enabled: boolean;
  private consentStatus: string;
  private config: TelemetryConfig;
  private collectedEvents: TelemetryEvent[] = [];

  constructor(config: TelemetryConfig) {
    this.config = config;
    this.enabled = config.enabled;
    this.consentStatus = config.consentStatus;
  }

  emit(event: Omit<TelemetryEvent, "timestamp">): boolean {
    // Check if telemetry is enabled
    if (!this.enabled) {
      return false;
    }

    // Validate event type
    if (!this.isValidEventType(event.eventType)) {
      this.logInternal(`Unknown event type: ${event.eventType}`);
      return false;
    }

    // Redaction pass 1: allowlist validation
    const redactedData = this.applyAllowlist(event.eventType, event.data);
    if (redactedData === null) {
      this.logInternal(`Redaction failed for event: ${event.eventType}`);
      return false;
    }

    // Redaction pass 2: sensitive data pattern detection
    if (containsSensitiveData(redactedData)) {
      const diagnostic = createSensitiveDataRejectionDiagnostic(redactedData);
      this.logInternal(`Sensitive data detected in event ${event.eventType}: ${diagnostic}`);
      return false;
    }

    // Check payload size
    const payloadSize = JSON.stringify(redactedData).length;
    if (payloadSize > MAX_EVENT_PAYLOAD_SIZE) {
      this.logInternal(
        `Event payload too large: ${payloadSize} bytes (max: ${MAX_EVENT_PAYLOAD_SIZE})`
      );
      return false;
    }

    // Create final event with timestamp
    const completedEvent: TelemetryEvent = {
      timestamp: Date.now(),
      eventType: event.eventType,
      context: event.context,
      data: redactedData as TelemetryEvent["data"]
    };

    // Send to sink
    this.config.sink.send(completedEvent);

    // Store for testing/inspection
    this.collectedEvents.push(completedEvent);

    return true;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  disable(): void {
    this.enabled = false;
    this.consentStatus = "disabled_by_consent";
  }

  getCollectedEvents(): TelemetryEvent[] {
    return [...this.collectedEvents];
  }

  /**
   * Validate event type is in the closed set.
   */
  private isValidEventType(eventType: unknown): eventType is TelemetryEventType {
    return typeof eventType === "string" && eventType in EVENT_ALLOWLIST;
  }

  /**
   * Apply allowlist: extract and validate only allowed fields for the event type.
   * Returns redacted data object or null if validation fails.
   */
  private applyAllowlist(
    eventType: TelemetryEventType,
    data: unknown
  ): Record<string, unknown> | null {
    if (typeof data !== "object" || data === null) {
      // Data should be an object
      this.logInternal(`Event data is not an object for ${eventType}`);
      return null;
    }

    const allowedFields = getAllowedFields(eventType);
    const redacted: Record<string, unknown> = { type: eventType };

    // If no fields are allowed, return just the type
    if (allowedFields.length === 0) {
      return redacted;
    }

    // Extract and validate each allowed field
    for (const fieldName of allowedFields) {
      const value = (data as Record<string, unknown>)[fieldName];

      // Skip if field not present
      if (value === undefined) {
        continue;
      }

      // Skip if field is null (allow null as a valid value for optional fields)
      if (value === null) {
        redacted[fieldName] = null;
        continue;
      }

      // Validate field bounds
      const boundError = validateFieldBound(fieldName, value);
      if (boundError) {
        this.logInternal(`Field validation failed for ${fieldName}: ${boundError}`);
        return null;
      }

      redacted[fieldName] = value;
    }

    return redacted;
  }

  /**
   * Internal logging for diagnostics (non-sensitive).
   * These logs are visible in development but not sent to telemetry.
   */
  private logInternal(message: string): void {
    // Only log in development
    if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.debug(`[Telemetry Internal] ${message}`);
    }
  }
}

/**
 * Create a telemetry service instance with default configuration.
 */
export function createTelemetryService(config: TelemetryConfig): TelemetryService {
  return new DefaultTelemetryService(config);
}

export type { TelemetryService, TelemetryEvent, TelemetryConfig } from "./types";
export { NoOpSink, ConsoleSink, RemoteSink } from "./sink";
export type { TelemetrySink } from "./types";
