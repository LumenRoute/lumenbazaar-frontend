import { describe, it, expect } from "vitest";

import { containsSensitiveData, createSensitiveDataRejectionDiagnostic } from "./redaction";

describe("Sensitive Data Redaction", () => {
  describe("containsSensitiveData", () => {
    it("should detect Stellar wallet addresses", () => {
      const address = "GDZST3XVCDTUJ76ZAV2HA72KYYX4YQFOMLZZZNNFNM3XJN2YQMXIJPME";
      expect(containsSensitiveData(address)).toBe(true);
    });

    it("should detect Stellar private keys", () => {
      const privateKey = "SBZVMB74Z76QZ3ZVK444XEPEBXWQV5DJTJZMXVC6SRWGSGIYWGEN2C54";
      expect(containsSensitiveData(privateKey)).toBe(true);
    });

    it("should detect 128-char hex strings (signatures)", () => {
      const signature = "A".repeat(128);
      expect(containsSensitiveData(signature)).toBe(true);
    });

    it("should detect 64-char hex strings (transaction hashes)", () => {
      const hash = "A".repeat(64);
      expect(containsSensitiveData(hash)).toBe(true);
    });

    it("should detect JWT-like patterns", () => {
      const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.TJVA95OrM7E2cBab30RMHrHDcEfxjoYZgeFONFh7HgQ";
      expect(containsSensitiveData(jwt)).toBe(true);
    });

    it("should detect objects with sensitive keys", () => {
      const obj = {
        publicField: "ok",
        signature: "secret"
      };
      expect(containsSensitiveData(obj)).toBe(true);
    });

    it("should detect nested sensitive data", () => {
      const obj = {
        level1: {
          level2: {
            walletAddress: "GDZST3XVCDTUJ76ZAV2HA72KYYX4YQFOMLZZZNNFNM3XJN2YQMXIJPME"
          }
        }
      };
      expect(containsSensitiveData(obj)).toBe(true);
    });

    it("should detect sensitive data in arrays", () => {
      const arr = [
        "safe",
        "GDZST3XVCDTUJ76ZAV2HA72KYYX4YQFOMLZZZNNFNM3XJN2YQMXIJPME"
      ];
      expect(containsSensitiveData(arr)).toBe(true);
    });

    it("should allow safe strings", () => {
      expect(containsSensitiveData("hello")).toBe(false);
      expect(containsSensitiveData("service")).toBe(false);
      expect(containsSensitiveData("USDC")).toBe(false);
    });

    it("should allow safe objects", () => {
      const obj = {
        eventType: "payment_verified",
        status: "success",
        duration_ms: 1234
      };
      expect(containsSensitiveData(obj)).toBe(false);
    });

    it("should allow safe arrays", () => {
      const arr = ["service", "data"];
      expect(containsSensitiveData(arr)).toBe(false);
    });

    it("should allow numbers and booleans", () => {
      expect(containsSensitiveData(123)).toBe(false);
      expect(containsSensitiveData(true)).toBe(false);
      expect(containsSensitiveData(false)).toBe(false);
    });

    it("should allow null and undefined", () => {
      expect(containsSensitiveData(null)).toBe(false);
      expect(containsSensitiveData(undefined)).toBe(false);
    });

    it("should handle mixed sensitive key names (case-insensitive)", () => {
      expect(
        containsSensitiveData({
          PaymentPayload: "secret"
        })
      ).toBe(true);

      expect(
        containsSensitiveData({
          PrivateKey: "secret"
        })
      ).toBe(true);

      expect(
        containsSensitiveData({
          WALLETADDRESS: "secret"
        })
      ).toBe(true);
    });
  });

  describe("createSensitiveDataRejectionDiagnostic", () => {
    it("should create diagnostic for sensitive strings", () => {
      const result = createSensitiveDataRejectionDiagnostic(
        "GDZST3XVCDTUJ76ZAV2HA72KYYX4YQFOMLZZZNNFNM3XJN2YQMXIJPME"
      );
      expect(result).toContain("sensitive pattern");
    });

    it("should create diagnostic for arrays", () => {
      const result = createSensitiveDataRejectionDiagnostic(["a", "b", "c"]);
      expect(result).toContain("array containing 3");
    });

    it("should create diagnostic for objects with sensitive keys", () => {
      const result = createSensitiveDataRejectionDiagnostic({
        signature: "secret",
        privateKey: "secret"
      });
      expect(result).toContain("sensitive key(s)");
      expect(result).toContain("signature");
    });

    it("should create diagnostic without leaking values", () => {
      const wallet = "GDZST3XVCDTUJ76ZAV2HA72KYYX4YQFOMLZZZNNFNM3XJN2YQMXIJPME";
      const diagnostic = createSensitiveDataRejectionDiagnostic({
        payment: {
          walletAddress: wallet
        }
      });
      expect(diagnostic).not.toContain(wallet);
    });
  });
});
