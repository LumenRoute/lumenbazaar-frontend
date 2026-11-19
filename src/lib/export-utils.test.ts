import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  redactSensitiveData,
  shouldRedactKey,
  formatResponseForDisplay,
  formatResponseForCopy,
  estimateResponseSize,
  validateResponseStructure,
  truncateForPreview,
  DEFAULT_REDACTION_CONFIG
} from "./export-utils";

describe("export-utils", () => {
  describe("redactSensitiveData", () => {
    it("should redact sensitive payment keys", () => {
      const data = {
        authorization: "bearer_token",
        paymentPayload: { amount: 10 },
        publicData: "visible"
      };

      const result = redactSensitiveData(data);

      expect(result).toEqual({
        authorization: "[redacted]",
        paymentPayload: "[redacted]",
        publicData: "visible"
      });
    });

    it("should handle case-insensitive key matching", () => {
      const data = {
        Authorization: "token",
        PRIVATEKEY: "secret",
        PaymentPayload: { data: "test" }
      };

      const result = redactSensitiveData(data);

      expect(result).toEqual({
        Authorization: "[redacted]",
        PRIVATEKEY: "[redacted]",
        PaymentPayload: "[redacted]"
      });
    });

    it("should redact keys containing sensitive patterns", () => {
      const data = {
        wallet_address: "stellar_addr",
        user_signature: "sig_data",
        api_secret_key: "secret"
      };

      const result = redactSensitiveData(data);

      expect(result).toEqual({
        wallet_address: "[redacted]",
        user_signature: "[redacted]",
        api_secret_key: "[redacted]"
      });
    });

    it("should support additional redaction keys", () => {
      const data = {
        apiKey: "secret",
        customSensitive: "value",
        publicData: "visible"
      };

      const result = redactSensitiveData(data, ["customSensitive"]);

      expect(result).toEqual({
        apiKey: "[redacted]",
        customSensitive: "[redacted]",
        publicData: "visible"
      });
    });

    it("should recursively redact nested objects", () => {
      const data = {
        user: {
          authorization: "token",
          name: "John"
        },
        settings: {
          privateKey: "secret"
        }
      };

      const result = redactSensitiveData(data);

      expect(result).toEqual({
        user: {
          authorization: "[redacted]",
          name: "John"
        },
        settings: {
          privateKey: "[redacted]"
        }
      });
    });

    it("should recursively redact arrays of objects", () => {
      const data = {
        items: [
          { authorization: "token1", value: 1 },
          { authorization: "token2", value: 2 }
        ]
      };

      const result = redactSensitiveData(data);

      expect(result).toEqual({
        items: [
          { authorization: "[redacted]", value: 1 },
          { authorization: "[redacted]", value: 2 }
        ]
      });
    });

    it("should handle null and undefined values", () => {
      const data = {
        nullable: null,
        undefinedValue: undefined,
        normal: "value"
      };

      const result = redactSensitiveData(data);

      expect(result).toEqual({
        nullable: null,
        undefinedValue: undefined,
        normal: "value"
      });
    });

    it("should not modify non-object types", () => {
      expect(redactSensitiveData("string")).toBe("string");
      expect(redactSensitiveData(123)).toBe(123);
      expect(redactSensitiveData(true)).toBe(true);
      expect(redactSensitiveData(null)).toBe(null);
    });

    it("should handle mixed array types", () => {
      const data = ["string", 123, { authorization: "token" }, null];

      const result = redactSensitiveData(data);

      expect(result).toEqual(["string", 123, { authorization: "[redacted]" }, null]);
    });
  });

  describe("shouldRedactKey", () => {
    it("should identify sensitive payment keys", () => {
      expect(shouldRedactKey("authorization")).toBe(true);
      expect(shouldRedactKey("paymentPayload")).toBe(true);
      expect(shouldRedactKey("privateKey")).toBe(true);
      expect(shouldRedactKey("secret")).toBe(true);
      expect(shouldRedactKey("signature")).toBe(true);
      expect(shouldRedactKey("signedXdr")).toBe(true);
      expect(shouldRedactKey("walletAddress")).toBe(true);
      expect(shouldRedactKey("xdr")).toBe(true);
    });

    it("should handle case-insensitive matching", () => {
      expect(shouldRedactKey("AUTHORIZATION")).toBe(true);
      expect(shouldRedactKey("PaYmEnTpAyLoAd")).toBe(true);
      expect(shouldRedactKey("PRIVATEKEY")).toBe(true);
    });

    it("should identify keys containing sensitive patterns", () => {
      expect(shouldRedactKey("user_authorization")).toBe(true);
      expect(shouldRedactKey("api_secret")).toBe(true);
      expect(shouldRedactKey("wallet_address")).toBe(true);
      expect(shouldRedactKey("transaction_signature")).toBe(true);
    });

    it("should not redact non-sensitive keys", () => {
      expect(shouldRedactKey("name")).toBe(false);
      expect(shouldRedactKey("id")).toBe(false);
      expect(shouldRedactKey("amount")).toBe(false);
      expect(shouldRedactKey("status")).toBe(false);
    });

    it("should check additional redaction keys", () => {
      expect(shouldRedactKey("customField", ["customField"])).toBe(true);
      expect(shouldRedactKey("CUSTOMFIELD", ["customField"])).toBe(true);
      expect(shouldRedactKey("other", ["customField"])).toBe(false);
    });
  });

  describe("formatResponseForDisplay", () => {
    it("should format object as JSON with indentation", () => {
      const data = { key: "value", nested: { num: 123 } };

      const result = formatResponseForDisplay(data);

      expect(result).toContain('"key": "value"');
      expect(result).toContain('"nested"');
      expect(result).toContain('"num": 123');
    });

    it("should return string as-is", () => {
      const str = "response string";

      const result = formatResponseForDisplay(str);

      expect(result).toBe(str);
    });

    it("should apply redaction when enabled", () => {
      const data = { authorization: "token", name: "John" };

      const result = formatResponseForDisplay(data, { redact: true });

      expect(result).toContain("[redacted]");
      expect(result).toContain("John");
    });

    it("should skip redaction when disabled", () => {
      const data = { authorization: "token", name: "John" };

      const result = formatResponseForDisplay(data, { redact: false });

      expect(result).toContain("token");
      expect(result).toContain("John");
    });

    it("should apply additional redaction keys", () => {
      const data = { customSecret: "value", name: "John" };

      const result = formatResponseForDisplay(data, {
        redact: true,
        additionalRedactionKeys: ["customSecret"]
      });

      expect(result).toContain("[redacted]");
    });
  });

  describe("formatResponseForCopy", () => {
    it("should return content and truncated flag", () => {
      const data = { key: "value" };

      const result = formatResponseForCopy(data);

      expect(result).toHaveProperty("content");
      expect(result).toHaveProperty("truncated");
      expect(result).toHaveProperty("reason");
      expect(result.truncated).toBe(false);
    });

    it("should apply redaction before formatting", () => {
      const data = { authorization: "token", value: "data" };

      const result = formatResponseForCopy(data, { redact: true });

      expect(result.content).toContain("[redacted]");
    });

    it("should truncate response if it exceeds maxSize", () => {
      const largeData = { data: "x".repeat(2000) };

      const result = formatResponseForCopy(largeData, { maxSize: 1000 });

      expect(result.truncated).toBe(true);
      expect(result.reason).toContain("exceeds");
      expect(result.content.length).toBeLessThanOrEqual(1000);
    });

    it("should not truncate if response is within limits", () => {
      const data = { key: "value" };

      const result = formatResponseForCopy(data, { maxSize: 1024 });

      expect(result.truncated).toBe(false);
      expect(result.reason).toBeUndefined();
    });

    it("should handle empty responses", () => {
      const result = formatResponseForCopy({});

      expect(result.content).toBe("{}");
      expect(result.truncated).toBe(false);
    });
  });

  describe("estimateResponseSize", () => {
    it("should categorize small responses", () => {
      const data = { key: "value" };

      const result = estimateResponseSize(data);

      expect(result.category).toBe("small");
      expect(result.canDisplay).toBe(true);
      expect(result.bytes).toBeGreaterThan(0);
    });

    it("should categorize medium responses", () => {
      const data = { key: "x".repeat(50000) };

      const result = estimateResponseSize(data);

      expect(result.category).toBe("medium");
      expect(result.canDisplay).toBe(true);
    });

    it("should categorize large responses", () => {
      const data = { key: "x".repeat(500000) };

      const result = estimateResponseSize(data);

      expect(result.category).toBe("large");
      expect(result.canDisplay).toBe(true);
    });

    it("should categorize huge responses", () => {
      const data = { key: "x".repeat(2000000) };

      const result = estimateResponseSize(data);

      expect(result.category).toBe("huge");
      expect(result.canDisplay).toBe(false);
    });

    it("should calculate bytes correctly", () => {
      const data = { test: "123" };

      const result = estimateResponseSize(data);

      expect(result.bytes).toBeGreaterThan(0);
      expect(typeof result.bytes).toBe("number");
    });
  });

  describe("validateResponseStructure", () => {
    it("should validate well-formed responses", () => {
      const data = { key: "value", nested: { num: 123 } };

      const result = validateResponseStructure(data);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect undefined responses", () => {
      const result = validateResponseStructure(undefined);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Response is undefined");
    });

    it("should detect non-JSON-serializable data", () => {
      const obj: any = { key: "value" };
      obj.self = obj; // Create circular reference

      const result = validateResponseStructure(obj);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should detect extremely large strings", () => {
      const data = "x".repeat(11 * 1024 * 1024);

      const result = validateResponseStructure(data);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Response contains extremely large string (>10MB)");
    });

    it("should accept valid strings", () => {
      const data = "valid response string";

      const result = validateResponseStructure(data);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should accept arrays", () => {
      const data = [1, 2, { key: "value" }];

      const result = validateResponseStructure(data);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should accept null", () => {
      const result = validateResponseStructure(null);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("truncateForPreview", () => {
    it("should return full content if within preview lines", () => {
      const data = { key: "value" };
      const formatted = JSON.stringify(data, null, 2);

      const result = truncateForPreview(formatted, 50);

      expect(result.truncated).toBe(false);
      expect(result.content).toBe(formatted);
      expect(result.totalLines).toBeGreaterThan(0);
    });

    it("should truncate content if exceeds preview lines", () => {
      const lines = Array.from({ length: 100 }, (_, i) => `line ${i}`).join("\n");

      const result = truncateForPreview(lines, 50);

      expect(result.truncated).toBe(true);
      expect(result.totalLines).toBe(100);
      expect(result.content.split("\n").length).toBeLessThanOrEqual(50);
    });

    it("should count total lines correctly", () => {
      const lines = "a\nb\nc\nd\ne";

      const result = truncateForPreview(lines, 10);

      expect(result.totalLines).toBe(5);
    });

    it("should handle JSON formatting", () => {
      const data = { a: 1, b: 2, c: 3 };
      const largeData = { ...data, d: Array(100).fill(0) };

      const result = truncateForPreview(largeData, 10);

      expect(result.totalLines).toBeGreaterThan(10);
    });

    it("should use default preview lines", () => {
      const lines = Array.from({ length: 100 }, (_, i) => `line ${i}`).join("\n");

      const result = truncateForPreview(lines);

      expect(result.content.split("\n").length).toBeLessThanOrEqual(50);
      expect(result.truncated).toBe(true);
    });
  });

  describe("DEFAULT_REDACTION_CONFIG", () => {
    it("should have sensible defaults", () => {
      expect(DEFAULT_REDACTION_CONFIG.maxSize).toBe(1024 * 1024);
      expect(DEFAULT_REDACTION_CONFIG.redact).toBe(true);
      expect(DEFAULT_REDACTION_CONFIG.additionalRedactionKeys).toEqual([]);
    });
  });

  describe("integration tests", () => {
    it("should handle complete export flow with redaction", () => {
      const sensitiveResponse = {
        authorization: "bearer_token_123",
        data: {
          result: { value: 42 },
          paymentPayload: { amount: 10 }
        },
        status: "success"
      };

      // Display format
      const displayContent = formatResponseForDisplay(sensitiveResponse, {
        redact: true
      });
      expect(displayContent).toContain("[redacted]");
      expect(displayContent).toContain("success");

      // Copy format with truncation
      const copyResult = formatResponseForCopy(sensitiveResponse, {
        redact: true,
        maxSize: 10000
      });
      expect(copyResult.content).toContain("[redacted]");
      expect(copyResult.truncated).toBe(false);
    });

    it("should handle large response with truncation for preview", () => {
      const largeResponse = {
        data: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          value: `item_${i}`
        }))
      };

      // Preview truncation
      const preview = truncateForPreview(
        formatResponseForDisplay(largeResponse),
        20
      );
      expect(preview.truncated).toBe(true);
      expect(preview.totalLines).toBeGreaterThan(20);

      // Size estimation
      const sizeInfo = estimateResponseSize(largeResponse);
      expect(sizeInfo.category).toMatch(/medium|large/);
    });

    it("should validate and handle malformed responses gracefully", () => {
      const circularObj: any = { key: "value" };
      circularObj.self = circularObj;

      const validation = validateResponseStructure(circularObj);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });
});
