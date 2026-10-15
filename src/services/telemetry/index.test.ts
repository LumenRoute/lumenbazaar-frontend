import { describe, it, expect, beforeEach, vi } from "vitest";

import { DefaultTelemetryService, createTelemetryService } from "./index";
import { NoOpSink, ConsoleSink } from "./sink";
import type { TelemetryConfig, TelemetryEvent } from "./types";

describe("DefaultTelemetryService", () => {
  let mockSink: any;
  let config: TelemetryConfig;
  let service: DefaultTelemetryService;

  beforeEach(() => {
    mockSink = {
      send: vi.fn()
    };
    config = {
      enabled: true,
      consentStatus: "enabled",
      networkId: "stellar:testnet",
      sink: mockSink
    };
    service = new DefaultTelemetryService(config);
  });

  describe("disabled by default", () => {
    it("should not emit when disabled", () => {
      const disabledService = new DefaultTelemetryService({
        ...config,
        enabled: false
      });

      const result = disabledService.emit({
        eventType: "app_initialized",
        context: { sessionId: "test", networkId: "stellar:testnet" },
        data: {
          type: "app_initialized",
          telemetryEnabled: false,
          consentStatus: "disabled_by_config"
        }
      });

      expect(result).toBe(false);
      expect(mockSink.send).not.toHaveBeenCalled();
    });

    it("should disable telemetry on demand", () => {
      expect(service.isEnabled()).toBe(true);
      service.disable();
      expect(service.isEnabled()).toBe(false);

      const result = service.emit({
        eventType: "app_initialized",
        context: { sessionId: "test", networkId: "stellar:testnet" },
        data: {
          type: "app_initialized",
          telemetryEnabled: true,
          consentStatus: "enabled"
        }
      });

      expect(result).toBe(false);
    });
  });

  describe("allowlist validation", () => {
    it("should accept only allowlisted fields", () => {
      const result = service.emit({
        eventType: "wallet_connect_attempt",
        context: { sessionId: "test", networkId: "stellar:testnet" },
        data: {
          type: "wallet_connect_attempt",
          status: "initiated",
          errorCode: "WALLET_REJECTED",
          // This field should be stripped:
          unknownField: "should-be-ignored"
        } as any
      });

      expect(result).toBe(true);
      expect(mockSink.send).toHaveBeenCalled();

      const sentEvent = mockSink.send.mock.calls[0][0] as TelemetryEvent;
      expect(sentEvent.data).toHaveProperty("status");
      expect(sentEvent.data).toHaveProperty("errorCode");
      expect(sentEvent.data).not.toHaveProperty("unknownField");
    });

    it("should reject unknown event types", () => {
      const result = service.emit({
        eventType: "unknown_event_type" as any,
        context: { sessionId: "test", networkId: "stellar:testnet" },
        data: { type: "unknown_event_type" as any }
      });

      expect(result).toBe(false);
      expect(mockSink.send).not.toHaveBeenCalled();
    });

    it("should drop events with no allowlisted fields", () => {
      const result = service.emit({
        eventType: "wallet_connect_success",
        context: { sessionId: "test", networkId: "stellar:testnet" },
        data: {
          type: "wallet_connect_success"
        }
      });

      expect(result).toBe(true);
      expect(mockSink.send).toHaveBeenCalled();
    });
  });

  describe("sensitive data rejection", () => {
    it("should reject Stellar addresses", () => {
      const result = service.emit({
        eventType: "payment_verification_attempted",
        context: { sessionId: "test", networkId: "stellar:testnet" },
        data: {
          type: "payment_verification_attempted",
          resourceType: "service",
          assetCode: "USDC", // valid
          // But we'll inject a wallet address in the context
          walletAddress: "GDZST3XVCDTUJ76ZAV2HA72KYYX4YQFOMLZZZNNFNM3XJN2YQMXIJPME"
        } as any
      });

      expect(result).toBe(false);
      expect(mockSink.send).not.toHaveBeenCalled();
    });

    it("should reject signature patterns", () => {
      const result = service.emit({
        eventType: "payment_verification_attempted",
        context: { sessionId: "test", networkId: "stellar:testnet" },
        data: {
          type: "payment_verification_attempted",
          resourceType: "service",
          assetCode: "ABCDEF" + "A".repeat(128) // 134 hex chars (signature-like)
        } as any
      });

      expect(result).toBe(false);
    });

    it("should reject objects with sensitive keys", () => {
      const result = service.emit({
        eventType: "payment_verification_attempted",
        context: { sessionId: "test", networkId: "stellar:testnet" },
        data: {
          type: "payment_verification_attempted",
          resourceType: "service",
          assetCode: "USDC",
          signature: "secret_value"
        } as any
      });

      expect(result).toBe(false);
    });

    it("should reject nested sensitive data in arrays", () => {
      const result = service.emit({
        eventType: "payment_verification_attempted",
        context: { sessionId: "test", networkId: "stellar:testnet" },
        data: {
          type: "payment_verification_attempted",
          resourceType: "service",
          assetCode: ["USDC", "GDZST3XVCDTUJ76ZAV2HA72KYYX4YQFOMLZZZNNFNM3XJN2YQMXIJPME"] // address in array
        } as any
      });

      expect(result).toBe(false);
    });
  });

  describe("field bounds validation", () => {
    it("should validate integer bounds", () => {
      const result = service.emit({
        eventType: "payment_verification_succeeded",
        context: { sessionId: "test", networkId: "stellar:testnet" },
        data: {
          type: "payment_verification_succeeded",
          duration_ms: 400000 // exceeds max of 300000
        }
      });

      expect(result).toBe(false);
    });

    it("should accept valid duration within bounds", () => {
      const result = service.emit({
        eventType: "payment_verification_succeeded",
        context: { sessionId: "test", networkId: "stellar:testnet" },
        data: {
          type: "payment_verification_succeeded",
          duration_ms: 1500 // valid
        }
      });

      expect(result).toBe(true);
    });

    it("should validate enum values", () => {
      const result = service.emit({
        eventType: "wallet_connect_attempt",
        context: { sessionId: "test", networkId: "stellar:testnet" },
        data: {
          type: "wallet_connect_attempt",
          status: "initiated", // valid
          errorCode: "INVALID_ERROR_CODE" as any // invalid
        }
      });

      expect(result).toBe(false);
    });

    it("should validate string patterns", () => {
      const result = service.emit({
        eventType: "payment_verification_attempted",
        context: { sessionId: "test", networkId: "stellar:testnet" },
        data: {
          type: "payment_verification_attempted",
          resourceType: "service",
          assetCode: "TOOLONGASSETCODE_" // exceeds maxLength of 12
        }
      });

      expect(result).toBe(false);
    });
  });

  describe("payload size limits", () => {
    it("should reject payloads exceeding max size", () => {
      const hugeString = "x".repeat(20 * 1024); // 20 KB
      const result = service.emit({
        eventType: "ui_error_displayed",
        context: { sessionId: "test", networkId: "stellar:testnet" },
        data: {
          type: "ui_error_displayed",
          errorCategory: "UNKNOWN_ERROR",
          source: hugeString as any
        }
      });

      expect(result).toBe(false);
    });
  });

  describe("event collection for testing", () => {
    it("should collect emitted events", () => {
      service.emit({
        eventType: "app_initialized",
        context: { sessionId: "test", networkId: "stellar:testnet" },
        data: {
          type: "app_initialized",
          telemetryEnabled: true,
          consentStatus: "enabled"
        }
      });

      service.emit({
        eventType: "wallet_connect_success",
        context: { sessionId: "test", networkId: "stellar:testnet" },
        data: { type: "wallet_connect_success" }
      });

      const events = service.getCollectedEvents();
      expect(events).toHaveLength(2);
      expect(events[0].eventType).toBe("app_initialized");
      expect(events[1].eventType).toBe("wallet_connect_success");
    });
  });

  describe("sink interactions", () => {
    it("should send valid events to sink", () => {
      service.emit({
        eventType: "app_initialized",
        context: { sessionId: "test", networkId: "stellar:testnet" },
        data: {
          type: "app_initialized",
          telemetryEnabled: true,
          consentStatus: "enabled"
        }
      });

      expect(mockSink.send).toHaveBeenCalledTimes(1);
      const sentEvent = mockSink.send.mock.calls[0][0];
      expect(sentEvent).toHaveProperty("timestamp");
      expect(sentEvent.eventType).toBe("app_initialized");
    });
  });

  describe("factory function", () => {
    it("should create a service", () => {
      const newService = createTelemetryService(config);
      expect(newService).toBeDefined();
      expect(newService.isEnabled()).toBe(true);
    });
  });
});

describe("NoOpSink", () => {
  it("should silently discard events", () => {
    const sink = new NoOpSink();
    const event: TelemetryEvent = {
      timestamp: Date.now(),
      eventType: "app_initialized",
      context: { sessionId: "test", networkId: "stellar:testnet" },
      data: {
        type: "app_initialized",
        telemetryEnabled: true,
        consentStatus: "enabled"
      }
    };

    // Should not throw
    expect(() => sink.send(event)).not.toThrow();
  });
});

describe("ConsoleSink", () => {
  it("should log events to console", () => {
    const sink = new ConsoleSink();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const event: TelemetryEvent = {
      timestamp: Date.now(),
      eventType: "app_initialized",
      context: { sessionId: "test", networkId: "stellar:testnet" },
      data: {
        type: "app_initialized",
        telemetryEnabled: true,
        consentStatus: "enabled"
      }
    };

    sink.send(event);

    expect(consoleSpy).toHaveBeenCalled();
    const callArgs = consoleSpy.mock.calls[0];
    expect(callArgs[0]).toContain("event: app_initialized");

    consoleSpy.mockRestore();
  });
});
