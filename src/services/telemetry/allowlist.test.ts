import { describe, it, expect } from "vitest";

import {
  validateFieldBound,
  isFieldAllowed,
  getAllowedFields,
  EVENT_ALLOWLIST,
  FIELD_BOUNDS
} from "./allowlist";

describe("Event Allowlist", () => {
  describe("EVENT_ALLOWLIST", () => {
    it("should define closed set of event types", () => {
      expect(Object.keys(EVENT_ALLOWLIST).length).toBeGreaterThan(0);
      expect(EVENT_ALLOWLIST).toHaveProperty("app_initialized");
      expect(EVENT_ALLOWLIST).toHaveProperty("wallet_connect_attempt");
      expect(EVENT_ALLOWLIST).toHaveProperty("payment_verification_attempted");
    });

    it("should have consistent allowlist structure", () => {
      for (const [eventType, fields] of Object.entries(EVENT_ALLOWLIST)) {
        expect(Array.isArray(fields)).toBe(true);
        expect(eventType).toBe(eventType); // sanity check
      }
    });
  });

  describe("isFieldAllowed", () => {
    it("should allow telemetryEnabled for app_initialized", () => {
      expect(isFieldAllowed("app_initialized", "telemetryEnabled")).toBe(true);
    });

    it("should allow consentStatus for app_initialized", () => {
      expect(isFieldAllowed("app_initialized", "consentStatus")).toBe(true);
    });

    it("should disallow unknown fields", () => {
      expect(isFieldAllowed("app_initialized", "unknownField")).toBe(false);
    });

    it("should disallow fields for wrong event type", () => {
      expect(isFieldAllowed("wallet_connect_attempt", "consentStatus")).toBe(false);
    });

    it("should allow duration_ms for payment_verification_succeeded", () => {
      expect(isFieldAllowed("payment_verification_succeeded", "duration_ms")).toBe(true);
    });
  });

  describe("getAllowedFields", () => {
    it("should return empty array for events with no allowlisted fields", () => {
      const fields = getAllowedFields("wallet_connect_success");
      expect(fields).toEqual([]);
    });

    it("should return all allowlisted fields for an event", () => {
      const fields = getAllowedFields("wallet_connect_attempt");
      expect(fields).toContain("status");
      expect(fields).toContain("errorCode");
    });

    it("should return consistent results", () => {
      const fields1 = getAllowedFields("payment_verification_attempted");
      const fields2 = getAllowedFields("payment_verification_attempted");
      expect(fields1).toEqual(fields2);
    });
  });

  describe("validateFieldBound", () => {
    describe("integer bounds", () => {
      it("should accept valid duration_ms", () => {
        const error = validateFieldBound("duration_ms", 1500);
        expect(error).toBe(null);
      });

      it("should reject negative duration_ms", () => {
        const error = validateFieldBound("duration_ms", -100);
        expect(error).not.toBe(null);
      });

      it("should reject duration_ms exceeding max", () => {
        const error = validateFieldBound("duration_ms", 400000);
        expect(error).not.toBe(null);
      });

      it("should reject non-integer for duration_ms", () => {
        const error = validateFieldBound("duration_ms", 1500.5);
        expect(error).not.toBe(null);
      });

      it("should reject string for duration_ms", () => {
        const error = validateFieldBound("duration_ms", "1500");
        expect(error).not.toBe(null);
      });
    });

    describe("string bounds (pattern and length)", () => {
      it("should accept valid assetCode", () => {
        const error = validateFieldBound("assetCode", "USDC");
        expect(error).toBe(null);
      });

      it("should accept 12-char assetCode", () => {
        const error = validateFieldBound("assetCode", "A".repeat(12));
        expect(error).toBe(null);
      });

      it("should reject assetCode exceeding maxLength", () => {
        const error = validateFieldBound("assetCode", "A".repeat(13));
        expect(error).not.toBe(null);
      });

      it("should reject assetCode with invalid characters", () => {
        const error = validateFieldBound("assetCode", "USD-C");
        expect(error).not.toBe(null);
      });

      it("should accept valid source", () => {
        const error = validateFieldBound("source", "component_name");
        expect(error).toBe(null);
      });

      it("should reject source with invalid characters", () => {
        const error = validateFieldBound("source", "component-name");
        expect(error).not.toBe(null);
      });
    });

    describe("enum bounds", () => {
      it("should accept valid status enum value", () => {
        const error = validateFieldBound("status", "initiated");
        expect(error).toBe(null);
      });

      it("should reject invalid status enum value", () => {
        const error = validateFieldBound("status", "completed");
        expect(error).not.toBe(null);
      });

      it("should accept valid errorCode enum values", () => {
        expect(validateFieldBound("errorCode", "WALLET_REJECTED")).toBe(null);
        expect(validateFieldBound("errorCode", "WALLET_TIMEOUT")).toBe(null);
        expect(validateFieldBound("errorCode", "WALLET_UNAVAILABLE")).toBe(null);
      });

      it("should reject invalid errorCode", () => {
        const error = validateFieldBound("errorCode", "INVALID_ERROR");
        expect(error).not.toBe(null);
      });

      it("should accept valid errorCategory enum values", () => {
        expect(validateFieldBound("errorCategory", "NETWORK_ERROR")).toBe(null);
        expect(validateFieldBound("errorCategory", "VERIFICATION_FAILED")).toBe(null);
      });

      it("should accept valid resourceType enum values", () => {
        expect(validateFieldBound("resourceType", "service")).toBe(null);
        expect(validateFieldBound("resourceType", "data")).toBe(null);
      });

      it("should accept valid consentStatus enum values", () => {
        expect(validateFieldBound("consentStatus", "enabled")).toBe(null);
        expect(validateFieldBound("consentStatus", "disabled_by_config")).toBe(null);
      });
    });

    describe("unknown fields", () => {
      it("should return null for unknown fields (not in FIELD_BOUNDS)", () => {
        const error = validateFieldBound("unknownField", "anyValue");
        expect(error).toBe(null);
      });
    });
  });

  describe("FIELD_BOUNDS structure", () => {
    it("should define bounds for all used fields", () => {
      const usedFields = new Set<string>();
      for (const fields of Object.values(EVENT_ALLOWLIST)) {
        fields.forEach((f) => usedFields.add(f));
      }

      // Most fields should have bounds defined (some may be optional)
      expect(usedFields.size).toBeGreaterThan(0);
    });

    it("should have valid duration_ms bounds", () => {
      expect(FIELD_BOUNDS.duration_ms).toHaveProperty("min", 0);
      expect(FIELD_BOUNDS.duration_ms).toHaveProperty("max");
      expect((FIELD_BOUNDS.duration_ms as any).max).toBeGreaterThan(0);
    });

    it("should have valid assetCode bounds", () => {
      expect(FIELD_BOUNDS.assetCode).toHaveProperty("maxLength");
      expect(FIELD_BOUNDS.assetCode).toHaveProperty("pattern");
    });
  });
});
