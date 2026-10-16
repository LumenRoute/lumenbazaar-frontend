import { describe, it, expect, beforeEach } from "vitest";

import { DefaultTelemetryService } from "./index";
import { NoOpSink } from "./sink";
import { containsSensitiveData } from "./redaction";
import type { TelemetryConfig } from "./types";

/**
 * Regression test: capture representative payment and wallet flow events,
 * and verify none contain sensitive data patterns.
 */
describe("Telemetry Regression: Sensitive Data Scanning", () => {
  let service: DefaultTelemetryService;
  let config: TelemetryConfig;

  beforeEach(() => {
    config = {
      enabled: true,
      consentStatus: "enabled",
      networkId: "stellar:testnet",
      sink: new NoOpSink()
    };
    service = new DefaultTelemetryService(config);
  });

  describe("Wallet connection flow events", () => {
    it("should not leak wallet address in connection events", () => {
      const walletAddress = "GDZST3XVCDTUJ76ZAV2HA72KYYX4YQFOMLZZZNNFNM3XJN2YQMXIJPME";

      service.emit({
        eventType: "wallet_connect_attempt",
        context: { sessionId: "test", networkId: "stellar:testnet" },
        data: {
          type: "wallet_connect_attempt",
          status: "initiated",
          errorCode: null,
          // Try to inject wallet address (should be rejected)
          walletAddress: walletAddress as any
        }
      });

      // Event should have been rejected
      const events = service.getCollectedEvents();
      expect(events).toHaveLength(0);
    });

    it("should accept valid wallet error codes", () => {
      service.emit({
        eventType: "wallet_connect_attempt",
        context: { sessionId: "test", networkId: "stellar:testnet" },
        data: {
          type: "wallet_connect_attempt",
          status: "initiated",
          errorCode: "WALLET_REJECTED"
        }
      });

      const events = service.getCollectedEvents();
      expect(events).toHaveLength(1);
      expect((events[0].data as any).errorCode).toBe("WALLET_REJECTED");
    });
  });

  describe("Payment verification flow events", () => {
    it("should not leak resource IDs or asset contracts", () => {
      service.emit({
        eventType: "payment_verification_attempted",
        context: { sessionId: "test", networkId: "stellar:testnet" },
        data: {
          type: "payment_verification_attempted",
          resourceType: "service",
          assetCode: "USDC",
          // Try to inject receipt or resource ID (should be stripped)
          receiptId: "receipt_123" as any,
          resourceId: "resource_456" as any
        }
      });

      const events = service.getCollectedEvents();
      expect(events).toHaveLength(1);
      expect(events[0].data).toHaveProperty("resourceType");
      expect(events[0].data).toHaveProperty("assetCode");
      expect((events[0].data as any).receiptId).toBeUndefined();
      expect((events[0].data as any).resourceId).toBeUndefined();
    });

    it("should not leak signatures in error events", () => {
      service.emit({
        eventType: "payment_verification_failed",
        context: { sessionId: "test", networkId: "stellar:testnet" },
        data: {
          type: "payment_verification_failed",
          errorCategory: "INVALID_SIGNATURE",
          duration_ms: 500,
          // Try to inject signature (should be rejected at allowlist step, then redaction)
          signature: "A".repeat(128) as any
        }
      });

      const events = service.getCollectedEvents();
      expect(events).toHaveLength(1);
      // Signature field should be stripped
      expect((events[0].data as any).signature).toBeUndefined();
    });
  });

  describe("Payment authorization flow events", () => {
    it("should not leak signed XDR or transaction hashes", () => {
      service.emit({
        eventType: "payment_authorized",
        context: { sessionId: "test", networkId: "stellar:testnet" },
        data: {
          type: "payment_authorized",
          duration_ms: 2000,
          // Try to inject XDR-like values (should be rejected)
          signedXDR: "A".repeat(200) as any,
          transactionHash: "A".repeat(64) as any
        }
      });

      const events = service.getCollectedEvents();
      expect(events).toHaveLength(1);
      expect((events[0].data as any).signedXDR).toBeUndefined();
      expect((events[0].data as any).transactionHash).toBeUndefined();
    });
  });

  describe("Settlement and receipt flow events", () => {
    it("should not leak receipt or correlation IDs", () => {
      service.emit({
        eventType: "settlement_completed",
        context: { sessionId: "test", networkId: "stellar:testnet" },
        data: {
          type: "settlement_completed",
          duration_ms: 3000,
          // Try to inject sensitive IDs (should be stripped)
          receiptId: "receipt_xyz" as any,
          correlationId: "corr_abc" as any
        }
      });

      const events = service.getCollectedEvents();
      expect(events).toHaveLength(1);
      expect((events[0].data as any).receiptId).toBeUndefined();
      expect((events[0].data as any).correlationId).toBeUndefined();
    });
  });

  describe("UI error events", () => {
    it("should not leak raw error messages or stack traces", () => {
      service.emit({
        eventType: "ui_error_displayed",
        context: { sessionId: "test", networkId: "stellar:testnet" },
        data: {
          type: "ui_error_displayed",
          errorCategory: "NETWORK_ERROR",
          source: "payment_component",
          // Try to inject raw error message (should be stripped or rejected)
          errorMessage: "Failed to verify with wallet GDZST3... at line 45" as any,
          stackTrace: "at function() at wallet.js:123" as any
        }
      });

      const events = service.getCollectedEvents();
      expect(events).toHaveLength(1);
      expect((events[0].data as any).errorMessage).toBeUndefined();
      expect((events[0].data as any).stackTrace).toBeUndefined();
    });
  });

  describe("Sensitive data pattern detection", () => {
    it("should reject events with Stellar address patterns anywhere in payload", () => {
      const stellarAddress = "GDZST3XVCDTUJ76ZAV2HA72KYYX4YQFOMLZZZNNFNM3XJN2YQMXIJPME";

      // Attempt to sneak in an address via allowed field
      const result = service.emit({
        eventType: "ui_error_displayed",
        context: { sessionId: "test", networkId: "stellar:testnet" },
        data: {
          type: "ui_error_displayed",
          errorCategory: "UNKNOWN_ERROR",
          source: stellarAddress as any // Try to inject address into "source"
        }
      });

      expect(result).toBe(false);
      expect(service.getCollectedEvents()).toHaveLength(0);
    });

    it("should reject events with signature patterns anywhere in payload", () => {
      const signature = "A".repeat(128); // 128-char hex (signature-like)

      const result = service.emit({
        eventType: "ui_error_displayed",
        context: { sessionId: "test", networkId: "stellar:testnet" },
        data: {
          type: "ui_error_displayed",
          errorCategory: "UNKNOWN_ERROR",
          source: signature as any // Try to inject signature into "source"
        }
      });

      expect(result).toBe(false);
      expect(service.getCollectedEvents()).toHaveLength(0);
    });

    it("should reject events with transaction hash patterns", () => {
      const txHash = "A".repeat(64); // 64-char hex (transaction hash)

      const result = service.emit({
        eventType: "ui_error_displayed",
        context: { sessionId: "test", networkId: "stellar:testnet" },
        data: {
          type: "ui_error_displayed",
          errorCategory: "UNKNOWN_ERROR",
          source: txHash as any
        }
      });

      expect(result).toBe(false);
    });
  });

  describe("All emitted events should pass final redaction check", () => {
    it("should only emit events that pass containsSensitiveData check", () => {
      // Emit a series of valid events
      const validEvents = [
        {
          eventType: "app_initialized" as const,
          context: { sessionId: "test", networkId: "stellar:testnet" as const },
          data: {
            type: "app_initialized" as const,
            telemetryEnabled: true,
            consentStatus: "enabled" as const
          }
        },
        {
          eventType: "wallet_connect_attempt" as const,
          context: { sessionId: "test", networkId: "stellar:testnet" as const },
          data: {
            type: "wallet_connect_attempt" as const,
            status: "initiated" as const,
            errorCode: "WALLET_REJECTED" as const
          }
        },
        {
          eventType: "payment_verification_succeeded" as const,
          context: { sessionId: "test", networkId: "stellar:testnet" as const },
          data: {
            type: "payment_verification_succeeded" as const,
            duration_ms: 1500
          }
        }
      ];

      validEvents.forEach((event) => service.emit(event as any));

      const events = service.getCollectedEvents();
      expect(events).toHaveLength(3);

      // Verify no event data contains sensitive patterns
      events.forEach((event) => {
        expect(containsSensitiveData(event.data)).toBe(false);
      });
    });
  });

  describe("Config and initialization", () => {
    it("should not emit when disabled by config", () => {
      const disabledService = new DefaultTelemetryService({
        ...config,
        enabled: false
      });

      disabledService.emit({
        eventType: "app_initialized",
        context: { sessionId: "test", networkId: "stellar:testnet" },
        data: {
          type: "app_initialized",
          telemetryEnabled: false,
          consentStatus: "disabled_by_config"
        }
      });

      expect(disabledService.getCollectedEvents()).toHaveLength(0);
    });

    it("should immediately stop emitting when disable() is called", () => {
      service.emit({
        eventType: "app_initialized",
        context: { sessionId: "test", networkId: "stellar:testnet" },
        data: {
          type: "app_initialized",
          telemetryEnabled: true,
          consentStatus: "enabled"
        }
      });

      expect(service.getCollectedEvents()).toHaveLength(1);

      // User withdraws consent
      service.disable();
      expect(service.isEnabled()).toBe(false);

      // Subsequent events are not emitted
      service.emit({
        eventType: "wallet_connect_success",
        context: { sessionId: "test", networkId: "stellar:testnet" },
        data: { type: "wallet_connect_success" }
      });

      expect(service.getCollectedEvents()).toHaveLength(1); // Still 1, not 2
    });
  });
});
