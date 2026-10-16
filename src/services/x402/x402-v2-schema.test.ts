/**
 * x402 v2 Schema Validation Test Suite
 *
 * Tests schema validation for x402 v2 payment requirements using
 * comprehensive fixtures covering valid, malformed, and edge cases.
 *
 * These tests ensure that:
 * - Valid challenges parse successfully
 * - Malformed fields fail closed with clear error messages
 * - Extensions are preserved without weakening validation
 * - All required fields are strictly validated
 */

import { describe, expect, it } from "vitest";

import {
  exactPaymentRequirementsSchema,
  paymentRequiredV2Schema,
  type ExactPaymentRequirements,
  type PaymentRequiredV2
} from "@/services/api/schemas";
import {
  allInvalidFixtures,
  allValidFixtures,
  invalidAmountLeadingZeros,
  invalidAmountNegative,
  invalidAmountNonNumeric,
  invalidAmountWithDecimals,
  invalidAmountZero,
  invalidAssetClassicAddress,
  invalidAssetEmpty,
  invalidAssetFormat,
  invalidEmptyAccepts,
  invalidNetworkMalformed,
  invalidNetworkUnsupported,
  invalidNoExactScheme,
  invalidRecipientClassicAddress,
  invalidRecipientContractAddress,
  invalidRecipientEmpty,
  invalidRecipientFormat,
  invalidResourceUrlMalformed,
  invalidResourceUrlRelative,
  invalidSchemeUpto,
  invalidTimeoutFloat,
  invalidTimeoutNegative,
  invalidTimeoutZero,
  invalidX402VersionV1,
  validExactRequirement,
  validExactRequirementPubnet,
  validExtensionPreservationTest,
  validExtraFieldPreservation,
  validLargeAmount,
  validLargeTimeout,
  validMinimumAmount,
  validMinimumTimeout,
  validPaymentRequiredV2,
  validPaymentRequiredV2MultiNetwork,
  validPaymentRequiredV2WithError,
  validPaymentRequiredV2WithExtensions,
  validPaymentRequiredV2WithMultipleSchemes
} from "./x402-v2-fixtures";

describe("ExactPaymentRequirements Schema", () => {
  describe("valid requirements", () => {
    it("parses standard requirement", () => {
      const result = exactPaymentRequirementsSchema.safeParse(validExactRequirement);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amount).toBe("500000");
        expect(result.data.network).toBe("stellar:testnet");
      }
    });

    it("parses pubnet requirement", () => {
      const result = exactPaymentRequirementsSchema.safeParse(validExactRequirementPubnet);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.network).toBe("stellar:pubnet");
      }
    });

    it("parses with preserved extra fields", () => {
      const result = exactPaymentRequirementsSchema.safeParse(validExtraFieldPreservation);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.extra).toHaveProperty("assetCode");
        expect(result.data.extra).toHaveProperty("x-custom-metadata");
      }
    });

    it("normalizes null extra to empty object", () => {
      const req = { ...validExactRequirement, extra: null };
      const result = exactPaymentRequirementsSchema.safeParse(req);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.extra).toEqual({});
      }
    });

    it("parses edge case: minimum timeout (1 second)", () => {
      const result = exactPaymentRequirementsSchema.safeParse(validMinimumTimeout);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.maxTimeoutSeconds).toBe(1);
      }
    });

    it("parses edge case: large timeout (1 week)", () => {
      const result = exactPaymentRequirementsSchema.safeParse(validLargeTimeout);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.maxTimeoutSeconds).toBe(604_800);
      }
    });

    it("parses edge case: minimum amount (1 atomic unit)", () => {
      const result = exactPaymentRequirementsSchema.safeParse(validMinimumAmount);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amount).toBe("1");
      }
    });

    it("parses edge case: large amount (1 trillion atomic units)", () => {
      const result = exactPaymentRequirementsSchema.safeParse(validLargeAmount);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amount).toBe("10000000000000");
      }
    });
  });

  describe("invalid amount field", () => {
    it("rejects amount with decimals", () => {
      const result = exactPaymentRequirementsSchema.safeParse(invalidAmountWithDecimals);
      expect(result.success).toBe(false);
    });

    it("rejects amount of zero", () => {
      const result = exactPaymentRequirementsSchema.safeParse(invalidAmountZero);
      expect(result.success).toBe(false);
    });

    it("rejects amount with leading zeros", () => {
      const result = exactPaymentRequirementsSchema.safeParse(invalidAmountLeadingZeros);
      expect(result.success).toBe(false);
    });

    it("rejects negative amount", () => {
      const result = exactPaymentRequirementsSchema.safeParse(invalidAmountNegative);
      expect(result.success).toBe(false);
    });

    it("rejects amount with non-numeric characters", () => {
      const result = exactPaymentRequirementsSchema.safeParse(invalidAmountNonNumeric);
      expect(result.success).toBe(false);
    });
  });

  describe("invalid network field", () => {
    it("rejects unsupported network", () => {
      const result = exactPaymentRequirementsSchema.safeParse(invalidNetworkUnsupported);
      expect(result.success).toBe(false);
    });

    it("rejects malformed network", () => {
      const result = exactPaymentRequirementsSchema.safeParse(invalidNetworkMalformed);
      expect(result.success).toBe(false);
    });
  });

  describe("invalid asset field", () => {
    it("rejects empty asset", () => {
      const result = exactPaymentRequirementsSchema.safeParse(invalidAssetEmpty);
      expect(result.success).toBe(false);
    });

    it("rejects invalid asset format", () => {
      const result = exactPaymentRequirementsSchema.safeParse(invalidAssetFormat);
      expect(result.success).toBe(false);
    });

    it("rejects classic address instead of contract ID", () => {
      const result = exactPaymentRequirementsSchema.safeParse(invalidAssetClassicAddress);
      expect(result.success).toBe(false);
    });
  });

  describe("invalid recipient (payTo) field", () => {
    it("rejects empty recipient", () => {
      const result = exactPaymentRequirementsSchema.safeParse(invalidRecipientEmpty);
      expect(result.success).toBe(false);
    });

    it("rejects invalid recipient format", () => {
      const result = exactPaymentRequirementsSchema.safeParse(invalidRecipientFormat);
      expect(result.success).toBe(false);
    });

    it("rejects contract address as recipient", () => {
      const result = exactPaymentRequirementsSchema.safeParse(invalidRecipientContractAddress);
      expect(result.success).toBe(false);
    });
  });

  describe("invalid timeout field", () => {
    it("rejects zero timeout", () => {
      const result = exactPaymentRequirementsSchema.safeParse(invalidTimeoutZero);
      expect(result.success).toBe(false);
    });

    it("rejects negative timeout", () => {
      const result = exactPaymentRequirementsSchema.safeParse(invalidTimeoutNegative);
      expect(result.success).toBe(false);
    });

    it("rejects float timeout", () => {
      const result = exactPaymentRequirementsSchema.safeParse(invalidTimeoutFloat);
      expect(result.success).toBe(false);
    });
  });

  describe("invalid scheme field", () => {
    it("rejects upto scheme", () => {
      const result = exactPaymentRequirementsSchema.safeParse(invalidSchemeUpto);
      expect(result.success).toBe(false);
    });
  });
});

describe("PaymentRequiredV2 Schema", () => {
  describe("valid challenges", () => {
    it("parses full challenge with metadata", () => {
      const result = paymentRequiredV2Schema.safeParse(validPaymentRequiredV2);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.x402Version).toBe(2);
        expect(result.data.accepts.length).toBeGreaterThan(0);
        expect(result.data.resource.url).toBeTruthy();
      }
    });

    it("parses challenge with error field", () => {
      const result = paymentRequiredV2Schema.safeParse(validPaymentRequiredV2WithError);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.error).toBe(
          "Premium API tier requires payment. Free tier limit exceeded."
        );
      }
    });

    it("parses challenge with extensions", () => {
      const result = paymentRequiredV2Schema.safeParse(validPaymentRequiredV2WithExtensions);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.extensions).toBeDefined();
        expect(result.data.extensions).toHaveProperty("x-rate-limit-after-payment");
      }
    });

    it("preserves unknown extensions without validation", () => {
      const result = paymentRequiredV2Schema.safeParse(validExtensionPreservationTest);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.extensions).toHaveProperty("x-custom-v1");
        expect(result.data.extensions).toHaveProperty("x-custom-v2");
        expect(result.data.extensions).toHaveProperty("x-future-feature");
      }
    });
  });

  describe("invalid challenges", () => {
    it("rejects wrong x402 version", () => {
      const result = paymentRequiredV2Schema.safeParse(invalidX402VersionV1);
      expect(result.success).toBe(false);
    });

    it("rejects challenge with no exact scheme", () => {
      const result = paymentRequiredV2Schema.safeParse(invalidNoExactScheme);
      expect(result.success).toBe(false);
    });

    it("rejects empty accepts array", () => {
      const result = paymentRequiredV2Schema.safeParse(invalidEmptyAccepts);
      expect(result.success).toBe(false);
    });

    it("rejects malformed resource URL", () => {
      const result = paymentRequiredV2Schema.safeParse(invalidResourceUrlMalformed);
      expect(result.success).toBe(false);
    });

    it("rejects relative resource URL", () => {
      const result = paymentRequiredV2Schema.safeParse(invalidResourceUrlRelative);
      expect(result.success).toBe(false);
    });
  });

  describe("multiple schemes and networks", () => {
    it("filters and validates multiple schemes (exact + upto)", () => {
      const result = paymentRequiredV2Schema.safeParse(validPaymentRequiredV2WithMultipleSchemes);
      expect(result.success).toBe(true);
      if (result.success) {
        // Schema should include both; filtering happens at challenge parsing level
        expect(result.data.accepts.length).toBeGreaterThanOrEqual(1);
      }
    });

    it("parses multiple networks", () => {
      const result = paymentRequiredV2Schema.safeParse(validPaymentRequiredV2MultiNetwork);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.accepts.length).toBeGreaterThanOrEqual(2);
        const networks = result.data.accepts.map((r) => r.network);
        expect(networks).toContain("stellar:testnet");
        expect(networks).toContain("stellar:pubnet");
      }
    });
  });

  describe("error messages", () => {
    it("provides clear error message for invalid amount", () => {
      const result = exactPaymentRequirementsSchema.safeParse(invalidAmountWithDecimals);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("positive integer");
      }
    });

    it("provides clear error message for invalid contract ID", () => {
      const result = exactPaymentRequirementsSchema.safeParse(invalidAssetFormat);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Soroban contract");
      }
    });

    it("provides clear error message for invalid address", () => {
      const result = exactPaymentRequirementsSchema.safeParse(invalidRecipientFormat);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Stellar account address");
      }
    });
  });

  describe("schema strictness", () => {
    it("uses .strict() to reject unknown fields in requirement", () => {
      const req = {
        ...validExactRequirement,
        unknownField: "should-be-rejected"
      };
      const result = exactPaymentRequirementsSchema.safeParse(req);
      expect(result.success).toBe(false);
    });
  });
});

describe("Comprehensive Fixture Coverage", () => {
  describe("all valid fixtures parse successfully", () => {
    it.each(
      allValidFixtures.map((fixture, index) => [index, fixture] as const)
    )("parses valid fixture %i", (_index, fixture) => {
      // Most fixtures are requirements; wrap in a full challenge if needed
      const isRequirement =
        "scheme" in fixture && fixture.scheme === "exact" && "amount" in fixture;

      if (isRequirement) {
        const result = exactPaymentRequirementsSchema.safeParse(fixture);
        expect(result.success).toBe(true);
      } else {
        const result = paymentRequiredV2Schema.safeParse(fixture);
        expect(result.success).toBe(true);
      }
    });
  });

  describe("all invalid fixtures fail validation", () => {
    it.each(
      allInvalidFixtures.map((fixture, index) => [index, fixture] as const)
    )("rejects invalid fixture %i", (_index, fixture) => {
      // Most fixtures are requirements
      const isRequirement =
        "scheme" in fixture && fixture.scheme === "exact" && "amount" in fixture;

      if (isRequirement) {
        const result = exactPaymentRequirementsSchema.safeParse(fixture);
        expect(result.success).toBe(false);
      } else {
        const result = paymentRequiredV2Schema.safeParse(fixture);
        expect(result.success).toBe(false);
      }
    });
  });
});

describe("x402 v2 Protocol Compliance", () => {
  describe("version enforcement", () => {
    it("enforces x402Version: 2 literal", () => {
      const challenge = { ...validPaymentRequiredV2, x402Version: 1 as never };
      const result = paymentRequiredV2Schema.safeParse(challenge);
      expect(result.success).toBe(false);
    });

    it("accepts x402Version: 2 only", () => {
      const result = paymentRequiredV2Schema.safeParse(validPaymentRequiredV2);
      expect(result.success).toBe(true);
    });
  });

  describe("exact scheme enforcement", () => {
    it("enforces scheme: 'exact' literal", () => {
      const req = { ...validExactRequirement, scheme: "upto" as never };
      const result = exactPaymentRequirementsSchema.safeParse(req);
      expect(result.success).toBe(false);
    });
  });

  describe("network enumeration", () => {
    it.each(["stellar:testnet", "stellar:pubnet"])("accepts network: %s", (network) => {
      const req = { ...validExactRequirement, network: network as never };
      const result = exactPaymentRequirementsSchema.safeParse(req);
      expect(result.success).toBe(true);
    });

    it("rejects other networks", () => {
      const req = { ...validExactRequirement, network: "other:network" as never };
      const result = exactPaymentRequirementsSchema.safeParse(req);
      expect(result.success).toBe(false);
    });
  });
});
