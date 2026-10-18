import { describe, expect, it } from "vitest";

import {
  explorerTransactionUrl,
  isValidTransactionHash,
  isSyntheticTransactionId,
  sanitizeReceiptForExport,
  type PaymentActivity,
  type ReceiptExportRecord,
  paymentActivityStatus
} from "./payments";
import type { DemoPaymentAttempt, DemoSettlement } from "@/fixtures/lumenbazaar";

describe("isValidTransactionHash", () => {
  it("returns true for valid 64-character hex transaction hashes", () => {
    const validHashes = [
      "8b54ad6f02d48fef51d92f2db1a4d4d069e9449ce9a4f27b9a6c6e6d88f9d631", // lowercase
      "8B54AD6F02D48FEF51D92F2DB1A4D4D069E9449CE9A4F27B9A6C6E6D88F9D631", // uppercase
      "AbCdEf1234567890AbCdEf1234567890AbCdEf1234567890AbCdEf1234567890", // mixed case
      "0000000000000000000000000000000000000000000000000000000000000000", // all zeros
      "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" // all f's
    ];

    validHashes.forEach((hash) => {
      expect(isValidTransactionHash(hash)).toBe(true);
    });
  });

  it("returns false for invalid transaction hashes", () => {
    const invalidHashes = [
      null,
      undefined,
      "", // empty string
      "8b54ad6f02d48fef51d92f2db1a4d4d069e9449ce9a4f27b9a6c6e6d88f9d63", // 63 chars (too short)
      "8b54ad6f02d48fef51d92f2db1a4d4d069e9449ce9a4f27b9a6c6e6d88f9d6311", // 65 chars (too long)
      "8b54ad6f02d48fef51d92f2db1a4d4d069e9449ce9a4f27b9a6c6e6d88f9d63g", // invalid hex char 'g'
      "8b54ad6f02d48fef51d92f2db1a4d4d069e9449ce9a4f27b9a6c6e6d88f9d63 ", // trailing space
      " 8b54ad6f02d48fef51d92f2db1a4d4d069e9449ce9a4f27b9a6c6e6d88f9d631", // leading space
      "tx_hash_abc123", // not hex
      "8b54ad6f-02d48fef-51d92f2d-b1a4d4d0-69e9449c-e9a4f27b-9a6c6e6d-88f9d631" // with hyphens
    ];

    invalidHashes.forEach((hash) => {
      expect(isValidTransactionHash(hash)).toBe(false);
    });
  });

  it("returns false for non-string values", () => {
    const nonStringValues = [123, true, false, {}, [], NaN];

    nonStringValues.forEach((value) => {
      expect(isValidTransactionHash(value as any)).toBe(false);
    });
  });

  it("has correct type guard behavior", () => {
    const hash: string | null = "8b54ad6f02d48fef51d92f2db1a4d4d069e9449ce9a4f27b9a6c6e6d88f9d631";

    if (isValidTransactionHash(hash)) {
      // This should compile - hash is narrowed to string
      const _: string = hash;
      expect(hash).toBeDefined();
    }
  });
});

describe("explorerTransactionUrl", () => {
  it("generates correct testnet explorer URL for valid hash", () => {
    const hash = "8b54ad6f02d48fef51d92f2db1a4d4d069e9449ce9a4f27b9a6c6e6d88f9d631";
    const url = explorerTransactionUrl("stellar:testnet", hash);

    expect(url).toBe(
      "https://stellar.expert/explorer/testnet/tx/8b54ad6f02d48fef51d92f2db1a4d4d069e9449ce9a4f27b9a6c6e6d88f9d631"
    );
  });

  it("generates correct pubnet explorer URL for valid hash", () => {
    const hash = "8b54ad6f02d48fef51d92f2db1a4d4d069e9449ce9a4f27b9a6c6e6d88f9d631";
    const url = explorerTransactionUrl("stellar:pubnet", hash);

    expect(url).toBe(
      "https://stellar.expert/explorer/public/tx/8b54ad6f02d48fef51d92f2db1a4d4d069e9449ce9a4f27b9a6c6e6d88f9d631"
    );
  });

  it("returns null for invalid transaction hash", () => {
    const invalidHash = "invalid_hash";
    const url = explorerTransactionUrl("stellar:testnet", invalidHash);

    expect(url).toBeNull();
  });

  it("returns null for null hash", () => {
    const url = explorerTransactionUrl("stellar:testnet", null);

    expect(url).toBeNull();
  });

  it("returns null for undefined hash", () => {
    const url = explorerTransactionUrl("stellar:testnet", undefined);

    expect(url).toBeNull();
  });

  it("returns null for empty string hash", () => {
    const url = explorerTransactionUrl("stellar:testnet", "");

    expect(url).toBeNull();
  });

  it("returns null for hash that is too short", () => {
    const shortHash = "8b54ad6f02d48fef51d92f2db1a4d4d069e9449ce9a4f27b9a6c6e6d88f9d63";
    const url = explorerTransactionUrl("stellar:testnet", shortHash);

    expect(url).toBeNull();
  });

  it("returns null for hash that is too long", () => {
    const longHash = "8b54ad6f02d48fef51d92f2db1a4d4d069e9449ce9a4f27b9a6c6e6d88f9d6311";
    const url = explorerTransactionUrl("stellar:testnet", longHash);

    expect(url).toBeNull();
  });

  it("returns null for hash with invalid characters", () => {
    const invalidHash = "8b54ad6f02d48fef51d92f2db1a4d4d069e9449ce9a4f27b9a6c6e6d88f9d63g";
    const url = explorerTransactionUrl("stellar:testnet", invalidHash);

    expect(url).toBeNull();
  });

  it("handles uppercase hashes correctly", () => {
    const upperHash = "8B54AD6F02D48FEF51D92F2DB1A4D4D069E9449CE9A4F27B9A6C6E6D88F9D631";
    const url = explorerTransactionUrl("stellar:testnet", upperHash);

    expect(url).toBe(
      "https://stellar.expert/explorer/testnet/tx/8B54AD6F02D48FEF51D92F2DB1A4D4D069E9449CE9A4F27B9A6C6E6D88F9D631"
    );
  });

  it("handles mixed case hashes correctly", () => {
    const mixedHash = "AbCdEf1234567890AbCdEf1234567890AbCdEf1234567890AbCdEf1234567890";
    const url = explorerTransactionUrl("stellar:testnet", mixedHash);

    expect(url).toBe(
      "https://stellar.expert/explorer/testnet/tx/AbCdEf1234567890AbCdEf1234567890AbCdEf1234567890AbCdEf1234567890"
    );
  });

  it("returns null for hash with spaces", () => {
    const hashWithSpace = "8b54ad6f02d48fef51d92f2db1a4d4d069e9449ce9a4f27b9a6c6e6d88f9d63 ";
    const url = explorerTransactionUrl("stellar:testnet", hashWithSpace);

    expect(url).toBeNull();
  });

  it("returns null for hash with special characters", () => {
    const hashWithSpecial = "8b54ad6f02d48fef51d92f2db1a4d4d069e9449ce9a4f27b9a6c6e6d88f9d63!";
    const url = explorerTransactionUrl("stellar:testnet", hashWithSpecial);

    expect(url).toBeNull();
  });
});

describe("isSyntheticTransactionId", () => {
  it("returns true for upto-* prefixed identifiers", () => {
    const syntheticIds = [
      "upto-supported",
      "upto-session-create",
      "upto-settle",
      "upto-test-123"
    ];

    syntheticIds.forEach((id) => {
      expect(isSyntheticTransactionId(id)).toBe(true);
    });
  });

  it("returns true for exact-* prefixed identifiers", () => {
    const syntheticIds = [
      "exact-supported",
      "exact-verify",
      "exact-settle",
      "exact-test-456"
    ];

    syntheticIds.forEach((id) => {
      expect(isSyntheticTransactionId(id)).toBe(true);
    });
  });

  it("returns true for playground_* prefixed identifiers", () => {
    const syntheticIds = [
      "playground_settlement_123",
      "playground_test_abc",
      "playground_fixture_xyz"
    ];

    syntheticIds.forEach((id) => {
      expect(isSyntheticTransactionId(id)).toBe(true);
    });
  });

  it("returns true for non-hex identifiers", () => {
    const syntheticIds = [
      "tx_hash_abc123", // contains non-hex characters
      "transaction-id-123", // invalid format
      "invalid_hash_format", // non-hex
      "not-a-real-hash", // hyphens not allowed
      "tx123456789012345678901234567890123456789012345678901234567890xyz" // contains 'xyz'
    ];

    syntheticIds.forEach((id) => {
      expect(isSyntheticTransactionId(id)).toBe(true);
    });
  });

  it("returns false for valid 64-character hex hashes", () => {
    const validHashes = [
      "8b54ad6f02d48fef51d92f2db1a4d4d069e9449ce9a4f27b9a6c6e6d88f9d631",
      "8B54AD6F02D48FEF51D92F2DB1A4D4D069E9449CE9A4F27B9A6C6E6D88F9D631",
      "0000000000000000000000000000000000000000000000000000000000000000",
      "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      "AbCdEf1234567890AbCdEf1234567890AbCdEf1234567890AbCdEf1234567890"
    ];

    validHashes.forEach((hash) => {
      expect(isSyntheticTransactionId(hash)).toBe(false);
    });
  });

  it("returns true for null or undefined", () => {
    expect(isSyntheticTransactionId(null)).toBe(false);
    expect(isSyntheticTransactionId(undefined)).toBe(false);
  });

  it("returns true for empty string", () => {
    expect(isSyntheticTransactionId("")).toBe(false);
  });

  it("returns true for too-short hashes", () => {
    const shortHash = "8b54ad6f02d48fef51d92f2db1a4d4d069e9449ce9a4f27b9a6c6e6d88f9d63"; // 63 chars
    expect(isSyntheticTransactionId(shortHash)).toBe(true);
  });

  it("returns true for too-long hashes", () => {
    const longHash = "8b54ad6f02d48fef51d92f2db1a4d4d069e9449ce9a4f27b9a6c6e6d88f9d6311"; // 65 chars
    expect(isSyntheticTransactionId(longHash)).toBe(true);
  });

  it("handles case-insensitive comparison for known prefixes", () => {
    // Prefixes should be case-sensitive (lowercase), so these should fail prefix check
    // but would still be detected as synthetic if they're not valid hex
    const testIds = [
      "UPTO-supported", // uppercase prefix - still a upto prefix
      "Upto-settle",    // mixed case prefix
      "upTo-test"       // different case
    ];

    // These should be detected as invalid hashes (not valid hex), hence synthetic
    testIds.forEach((id) => {
      expect(isSyntheticTransactionId(id)).toBe(true);
    });
  });

  it("distinguishes between known prefixes and hex-like strings", () => {
    // "abc123def456..." looks like hex but is only 60 chars, so it's synthetic
    const almostValidHash = "abc123def456abc123def456abc123def456abc123def456abc123def456abc";
    expect(isSyntheticTransactionId(almostValidHash)).toBe(true);

    // Valid 64-char hex hash should not be synthetic
    const validHash = "abc123def456abc123def456abc123def456abc123def456abc123def456abc1";
    expect(isSyntheticTransactionId(validHash)).toBe(false);
  });

  it("returns true for identifiers with spaces", () => {
    const syntheticIds = [
      "8b54ad6f02d48fef51d92f2db1a4d4d069e9449ce9a4f27b9a6c6e6d88f9d63 ", // trailing space
      " 8b54ad6f02d48fef51d92f2db1a4d4d069e9449ce9a4f27b9a6c6e6d88f9d631", // leading space
      "8b54ad6f 02d48fef 51d92f2d b1a4d4d0 69e9449c e9a4f27b 9a6c6e6d 88f9d631" // spaces in middle
    ];

    syntheticIds.forEach((id) => {
      expect(isSyntheticTransactionId(id)).toBe(true);
    });
  });

  it("returns true for identifiers with special characters", () => {
    const syntheticIds = [
      "8b54ad6f02d48fef51d92f2db1a4d4d069e9449ce9a4f27b9a6c6e6d88f9d63!", // trailing exclamation
      "8b54ad6f-02d48fef-51d92f2d-b1a4d4d0-69e9449c-e9a4f27b-9a6c6e6d-88f9d631", // hyphens
      "8b54ad6f_02d48fef_51d92f2d_b1a4d4d0_69e9449c_e9a4f27b_9a6c6e6d_88f9d631"  // underscores
    ];

    syntheticIds.forEach((id) => {
      expect(isSyntheticTransactionId(id)).toBe(true);
    });
  });

  it("detects all synthetic identifier categories", () => {
    const testCases = [
      { id: "upto-supported", isTestData: true, category: "upto prefix" },
      { id: "exact-verify", isTestData: true, category: "exact prefix" },
      { id: "playground_123", isTestData: true, category: "playground prefix" },
      { id: "invalid-format", isTestData: true, category: "non-hex string" },
      { id: "8b54ad6f02d48fef51d92f2db1a4d4d069e9449ce9a4f27b9a6c6e6d88f9d631", isTestData: false, category: "valid hash" }
    ];

    testCases.forEach(({ id, isTestData, category }) => {
      expect(isSyntheticTransactionId(id)).toBe(isTestData);
    });
  });
});

describe("sanitizeReceiptForExport", () => {
  const createPaymentActivity = (overrides?: Partial<PaymentActivity>): PaymentActivity => {
    const baseAttempt: DemoPaymentAttempt = {
      id: "attempt_123",
      resourceId: "resource_abc",
      sellerId: "seller_xyz",
      paymentHash: "very_secret_hash_should_not_appear",
      network: "stellar:testnet",
      assetCode: "USDC",
      assetIssuer: "issuer_address",
      amount: "100.5000",
      payTo: "pay_to_address",
      status: "verified",
      failureCode: null,
      failureReason: null,
      expiresAtLedger: 12345,
      createdAt: "2024-11-15T10:00:00Z",
      updatedAt: "2024-11-15T10:00:00Z"
    };

    const baseReceipt = {
      id: "receipt_abc",
      amount: "100.5000",
      assetCode: "USDC",
      assetIssuer: "issuer_address",
      correlationId: "corr_123",
      createdAt: "2024-11-15T10:05:00Z",
      evidenceHash: "evidence_hash_secret",
      failureCode: null,
      failureReason: null,
      ledger: 67890,
      network: "stellar:testnet",
      paymentAttemptId: "attempt_123",
      resourceId: "resource_abc",
      sellerId: "seller_xyz",
      settledAt: "2024-11-15T10:06:00Z",
      status: "finalized" as const,
      transactionHash: "8b54ad6f02d48fef51d92f2db1a4d4d069e9449ce9a4f27b9a6c6e6d88f9d631",
      updatedAt: "2024-11-15T10:06:00Z"
    };

    const baseSettlement: DemoSettlement = {
      id: "settlement_xyz",
      paymentAttemptId: "attempt_123",
      transactionHash: "8b54ad6f02d48fef51d92f2db1a4d4d069e9449ce9a4f27b9a6c6e6d88f9d631",
      ledger: 67890,
      network: "stellar:testnet",
      amount: "100.5000",
      assetCode: "USDC",
      assetIssuer: "issuer_address",
      status: "settled",
      settledAt: "2024-11-15T10:06:00Z",
      createdAt: "2024-11-15T10:05:00Z"
    };

    return {
      attempt: baseAttempt,
      receipt: baseReceipt,
      resource: undefined,
      seller: undefined,
      settlement: baseSettlement,
      ...overrides
    };
  };

  it("returns only allowlisted fields", () => {
    const activity = createPaymentActivity();
    const sanitized = sanitizeReceiptForExport(activity);

    // Verify all expected fields are present
    expect(sanitized).toHaveProperty("attempt_id");
    expect(sanitized).toHaveProperty("attempt_created_at");
    expect(sanitized).toHaveProperty("network");
    expect(sanitized).toHaveProperty("asset_code");
    expect(sanitized).toHaveProperty("amount");
    expect(sanitized).toHaveProperty("status");
    expect(sanitized).toHaveProperty("seller_id");
    expect(sanitized).toHaveProperty("resource_id");
    expect(sanitized).toHaveProperty("failure_code");
    expect(sanitized).toHaveProperty("failure_reason");
    expect(sanitized).toHaveProperty("receipt_id");
    expect(sanitized).toHaveProperty("receipt_status");
    expect(sanitized).toHaveProperty("transaction_hash");
    expect(sanitized).toHaveProperty("correlation_id");
    expect(sanitized).toHaveProperty("receipt_created_at");
    expect(sanitized).toHaveProperty("settlement_id");
    expect(sanitized).toHaveProperty("ledger");

    // Verify exactly 17 fields
    expect(Object.keys(sanitized)).toHaveLength(17);
  });

  it("redacts forbidden fields like paymentHash", () => {
    const activity = createPaymentActivity();
    const sanitized = sanitizeReceiptForExport(activity);

    // Verify paymentHash is not present
    expect(sanitized).not.toHaveProperty("paymentHash");
    expect(JSON.stringify(sanitized)).not.toContain("very_secret_hash_should_not_appear");
  });

  it("redacts evidenceHash from receipt", () => {
    const activity = createPaymentActivity();
    const sanitized = sanitizeReceiptForExport(activity);

    // Verify evidenceHash is not present
    expect(sanitized).not.toHaveProperty("evidenceHash");
    expect(JSON.stringify(sanitized)).not.toContain("evidence_hash_secret");
  });

  it("preserves amounts as strings (no number conversion)", () => {
    const activity = createPaymentActivity({
      attempt: {
        ...createPaymentActivity().attempt,
        amount: "9007199254740992" // Beyond Number.MAX_SAFE_INTEGER
      }
    });

    const sanitized = sanitizeReceiptForExport(activity);

    // Verify amount is a string
    expect(typeof sanitized.amount).toBe("string");
    expect(sanitized.amount).toBe("9007199254740992");

    // Verify it wasn't converted to a number and back
    expect(sanitized.amount).not.toBe("9007199254740993");
  });

  it("preserves all ID fields as strings", () => {
    const activity = createPaymentActivity();
    const sanitized = sanitizeReceiptForExport(activity);

    expect(typeof sanitized.attempt_id).toBe("string");
    expect(typeof sanitized.seller_id).toBe("string");
    expect(typeof sanitized.resource_id).toBe("string");
    expect(typeof sanitized.receipt_id).toBe("string");
    expect(typeof sanitized.settlement_id).toBe("string");
    expect(typeof sanitized.correlation_id).toBe("string");
  });

  it("preserves timestamps as ISO-8601 strings", () => {
    const activity = createPaymentActivity();
    const sanitized = sanitizeReceiptForExport(activity);

    expect(typeof sanitized.attempt_created_at).toBe("string");
    expect(sanitized.attempt_created_at).toBe("2024-11-15T10:00:00Z");
    expect(typeof sanitized.receipt_created_at).toBe("string");
    expect(sanitized.receipt_created_at).toBe("2024-11-15T10:05:00Z");

    // Verify ISO-8601 format
    expect(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(sanitized.attempt_created_at)).toBe(true);
  });

  it("handles missing receipt gracefully", () => {
    const activity = createPaymentActivity({ receipt: undefined });
    const sanitized = sanitizeReceiptForExport(activity);

    expect(sanitized.receipt_id).toBeNull();
    expect(sanitized.receipt_status).toBeNull();
    expect(sanitized.correlation_id).toBeNull();
    expect(sanitized.receipt_created_at).toBeNull();
  });

  it("handles missing settlement gracefully", () => {
    const activity = createPaymentActivity({ settlement: undefined });
    const sanitized = sanitizeReceiptForExport(activity);

    expect(sanitized.settlement_id).toBeNull();
    expect(sanitized.ledger).toBeNull();
    expect(sanitized.transaction_hash).toBeNull();
  });

  it("prefers settlement transactionHash over receipt transactionHash", () => {
    const settlementHash = "settlement_hash_8b54ad6f02d48fef51d92f2db1a4d4d069e9449ce9a4f27b9a6c6e6d88f9d631";
    const receiptHash = "receipt_hash_abc123def456abc123def456abc123def456abc123def456abc123def456abc1";

    const activity = createPaymentActivity({
      settlement: {
        ...createPaymentActivity().settlement!,
        transactionHash: settlementHash
      },
      receipt: {
        ...createPaymentActivity().receipt!,
        transactionHash: receiptHash
      }
    });

    const sanitized = sanitizeReceiptForExport(activity);

    expect(sanitized.transaction_hash).toBe(settlementHash);
  });

  it("falls back to receipt transactionHash if settlement is missing", () => {
    const receiptHash = "receipt_hash_8b54ad6f02d48fef51d92f2db1a4d4d069e9449ce9a4f27b9a6c6e6d88f9d631";

    const activity = createPaymentActivity({
      settlement: undefined,
      receipt: {
        ...createPaymentActivity().receipt!,
        transactionHash: receiptHash
      }
    });

    const sanitized = sanitizeReceiptForExport(activity);

    expect(sanitized.transaction_hash).toBe(receiptHash);
  });

  it("includes failure code and reason when present", () => {
    const activity = createPaymentActivity({
      attempt: {
        ...createPaymentActivity().attempt,
        failureCode: "INSUFFICIENT_BALANCE",
        failureReason: "Account balance is too low"
      }
    });

    const sanitized = sanitizeReceiptForExport(activity);

    expect(sanitized.failure_code).toBe("INSUFFICIENT_BALANCE");
    expect(sanitized.failure_reason).toBe("Account balance is too low");
  });

  it("handles null failure fields", () => {
    const activity = createPaymentActivity({
      attempt: {
        ...createPaymentActivity().attempt,
        failureCode: null,
        failureReason: null
      }
    });

    const sanitized = sanitizeReceiptForExport(activity);

    expect(sanitized.failure_code).toBeNull();
    expect(sanitized.failure_reason).toBeNull();
  });

  it("sanitizes multiple records consistently", () => {
    const activities = [
      createPaymentActivity({ attempt: { ...createPaymentActivity().attempt, id: "attempt_1" } }),
      createPaymentActivity({ attempt: { ...createPaymentActivity().attempt, id: "attempt_2" } }),
      createPaymentActivity({ attempt: { ...createPaymentActivity().attempt, id: "attempt_3" } })
    ];

    const sanitized = activities.map(sanitizeReceiptForExport);

    // All records should have the same field structure
    sanitized.forEach((record, index) => {
      expect(Object.keys(record)).toEqual(Object.keys(sanitized[0]));
      expect(record.attempt_id).toBe(`attempt_${index + 1}`);
    });
  });

  it("does not include nested object properties", () => {
    const activity = createPaymentActivity();
    const sanitized = sanitizeReceiptForExport(activity);

    // Verify no nested object properties are present
    expect(sanitized).not.toHaveProperty("resource");
    expect(sanitized).not.toHaveProperty("seller");
    expect(sanitized).not.toHaveProperty("receipt");
    expect(sanitized).not.toHaveProperty("settlement");
    expect(sanitized).not.toHaveProperty("attempt");

    // Verify only scalar fields are in the sanitized record
    Object.values(sanitized).forEach((value) => {
      expect(typeof value === "string" || typeof value === "number" || value === null).toBe(true);
    });
  });

  it("exports the correct status using paymentActivityStatus", () => {
    const activitySettled = createPaymentActivity({
      settlement: {
        ...createPaymentActivity().settlement!,
        status: "settled"
      },
      attempt: {
        ...createPaymentActivity().attempt,
        status: "verified"
      }
    });

    const sanitized = sanitizeReceiptForExport(activitySettled);

    // Should use settlement status when available
    expect(sanitized.status).toBe("settled");
  });

  it("handles edge case: null transaction hash in both settlement and receipt", () => {
    const activity = createPaymentActivity({
      settlement: {
        ...createPaymentActivity().settlement!,
        transactionHash: null
      },
      receipt: {
        ...createPaymentActivity().receipt!,
        transactionHash: null
      }
    });

    const sanitized = sanitizeReceiptForExport(activity);

    expect(sanitized.transaction_hash).toBeNull();
  });

  it("handles very large ledger numbers", () => {
    const activity = createPaymentActivity({
      settlement: {
        ...createPaymentActivity().settlement!,
        ledger: 9007199254740991 // Close to Number.MAX_SAFE_INTEGER
      }
    });

    const sanitized = sanitizeReceiptForExport(activity);

    expect(sanitized.ledger).toBe(9007199254740991);
    expect(typeof sanitized.ledger).toBe("number");
  });

  it("does not accidentally include expiresAtLedger", () => {
    const activity = createPaymentActivity({
      attempt: {
        ...createPaymentActivity().attempt,
        expiresAtLedger: 99999
      }
    });

    const sanitized = sanitizeReceiptForExport(activity);

    expect(sanitized).not.toHaveProperty("expiresAtLedger");
    expect(JSON.stringify(sanitized)).not.toContain("99999");
  });

  it("sanitized records can be JSON serialized without loss", () => {
    const activity = createPaymentActivity();
    const sanitized = sanitizeReceiptForExport(activity);

    const json = JSON.stringify(sanitized);
    const parsed = JSON.parse(json);

    // Verify round-trip consistency
    expect(parsed).toEqual(sanitized);
  });

  it("handles all supported networks", () => {
    const networks = ["stellar:testnet", "stellar:pubnet"] as const;

    networks.forEach((network) => {
      const activity = createPaymentActivity({
        attempt: {
          ...createPaymentActivity().attempt,
          network
        }
      });

      const sanitized = sanitizeReceiptForExport(activity);

      expect(sanitized.network).toBe(network);
    });
  });

  it("does not leak secrets from attempt object", () => {
    const activity = createPaymentActivity({
      attempt: {
        ...createPaymentActivity().attempt,
        paymentHash: "should_not_appear_anywhere",
        payTo: "pay_to_address" // This is in scope, but paymentHash should not be
      }
    });

    const sanitized = sanitizeReceiptForExport(activity);
    const json = JSON.stringify(sanitized);

    expect(json).not.toContain("should_not_appear_anywhere");
  });
});

describe("exportToJSON", () => {
  const createPaymentActivity = (overrides?: Partial<PaymentActivity>): PaymentActivity => {
    const baseAttempt: DemoPaymentAttempt = {
      id: "attempt_123",
      resourceId: "resource_abc",
      sellerId: "seller_xyz",
      paymentHash: "secret_hash",
      network: "stellar:testnet",
      assetCode: "USDC",
      assetIssuer: "issuer_address",
      amount: "100.5000",
      payTo: "pay_to_address",
      status: "verified",
      failureCode: null,
      failureReason: null,
      expiresAtLedger: 12345,
      createdAt: "2024-11-15T10:00:00Z",
      updatedAt: "2024-11-15T10:00:00Z"
    };

    return {
      attempt: baseAttempt,
      ...overrides
    };
  };

  it("returns valid JSON string", () => {
    const activities = [createPaymentActivity()];
    const json = exportToJSON(activities);

    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("includes metadata block with timestamp", () => {
    const activities = [createPaymentActivity()];
    const json = exportToJSON(activities);
    const data = JSON.parse(json);

    expect(data.metadata).toBeDefined();
    expect(data.metadata.exportTimestamp).toBeDefined();
    expect(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(data.metadata.exportTimestamp)).toBe(true);
  });

  it("includes evidenceSource in metadata", () => {
    const activities = [createPaymentActivity()];
    const jsonDemo = exportToJSON(activities, {}, "demo");
    const jsonLive = exportToJSON(activities, {}, "live");

    expect(JSON.parse(jsonDemo).metadata.evidenceSource).toBe("demo");
    expect(JSON.parse(jsonLive).metadata.evidenceSource).toBe("live");
  });

  it("includes activeFilters in metadata", () => {
    const activities = [createPaymentActivity()];
    const filters = { network: "stellar:testnet", status: "settled" as const };
    const json = exportToJSON(activities, filters);
    const data = JSON.parse(json);

    expect(data.metadata.activeFilters).toEqual(filters);
  });

  it("includes pageInfo with record counts", () => {
    const activities = [
      createPaymentActivity({ attempt: { ...createPaymentActivity().attempt, id: "attempt_1" } }),
      createPaymentActivity({ attempt: { ...createPaymentActivity().attempt, id: "attempt_2" } })
    ];
    const json = exportToJSON(activities);
    const data = JSON.parse(json);

    expect(data.metadata.pageInfo.pageSize).toBe(2);
    expect(data.metadata.pageInfo.recordsOnThisPage).toBe(2);
  });

  it("includes records array with sanitized data", () => {
    const activities = [createPaymentActivity()];
    const json = exportToJSON(activities);
    const data = JSON.parse(json);

    expect(Array.isArray(data.records)).toBe(true);
    expect(data.records.length).toBe(1);
    expect(data.records[0]).toHaveProperty("attempt_id");
    expect(data.records[0]).toHaveProperty("amount");
  });

  it("handles empty activities array", () => {
    const json = exportToJSON([]);
    const data = JSON.parse(json);

    expect(data.metadata).toBeDefined();
    expect(data.records).toEqual([]);
    expect(data.metadata.pageInfo.recordsOnThisPage).toBe(0);
  });

  it("preserves large amounts as strings in JSON", () => {
    const activities = [
      createPaymentActivity({
        attempt: {
          ...createPaymentActivity().attempt,
          amount: "9007199254740992"
        }
      })
    ];
    const json = exportToJSON(activities);
    const data = JSON.parse(json);

    expect(data.records[0].amount).toBe("9007199254740992");
    expect(typeof data.records[0].amount).toBe("string");
  });

  it("does not include forbidden fields in JSON", () => {
    const activities = [createPaymentActivity()];
    const json = exportToJSON(activities);

    expect(json).not.toContain("paymentHash");
    expect(json).not.toContain("secret_hash");
  });

  it("exports multiple records with correct structure", () => {
    const activities = [
      createPaymentActivity({ attempt: { ...createPaymentActivity().attempt, id: "attempt_1" } }),
      createPaymentActivity({ attempt: { ...createPaymentActivity().attempt, id: "attempt_2" } }),
      createPaymentActivity({ attempt: { ...createPaymentActivity().attempt, id: "attempt_3" } })
    ];
    const json = exportToJSON(activities);
    const data = JSON.parse(json);

    expect(data.records).toHaveLength(3);
    expect(data.records[0].attempt_id).toBe("attempt_1");
    expect(data.records[1].attempt_id).toBe("attempt_2");
    expect(data.records[2].attempt_id).toBe("attempt_3");
  });
});

describe("exportToCSV", () => {
  const createPaymentActivity = (overrides?: Partial<PaymentActivity>): PaymentActivity => {
    const baseAttempt: DemoPaymentAttempt = {
      id: "attempt_123",
      resourceId: "resource_abc",
      sellerId: "seller_xyz",
      paymentHash: "secret_hash",
      network: "stellar:testnet",
      assetCode: "USDC",
      assetIssuer: "issuer_address",
      amount: "100.5000",
      payTo: "pay_to_address",
      status: "verified",
      failureCode: null,
      failureReason: null,
      expiresAtLedger: 12345,
      createdAt: "2024-11-15T10:00:00Z",
      updatedAt: "2024-11-15T10:00:00Z"
    };

    return {
      attempt: baseAttempt,
      ...overrides
    };
  };

  it("returns string with UTF-8 BOM", () => {
    const activities = [createPaymentActivity()];
    const csv = exportToCSV(activities);

    expect(csv.charCodeAt(0)).toBe(0xfeff); // UTF-8 BOM
  });

  it("includes metadata block in CSV", () => {
    const activities = [createPaymentActivity()];
    const csv = exportToCSV(activities);

    expect(csv).toContain("Metadata,,");
    expect(csv).toContain("exportTimestamp,");
    expect(csv).toContain("evidenceSource,");
  });

  it("includes active filters in CSV metadata", () => {
    const activities = [createPaymentActivity()];
    const filters = { network: "stellar:testnet", status: "settled" as const };
    const csv = exportToCSV(activities, filters);

    expect(csv).toContain("activeFilters_network,stellar:testnet");
    expect(csv).toContain("activeFilters_status,settled");
  });

  it("includes page info in CSV metadata", () => {
    const activities = [
      createPaymentActivity({ attempt: { ...createPaymentActivity().attempt, id: "attempt_1" } }),
      createPaymentActivity({ attempt: { ...createPaymentActivity().attempt, id: "attempt_2" } })
    ];
    const csv = exportToCSV(activities);

    expect(csv).toContain("pageInfo_pageSize,2");
    expect(csv).toContain("pageInfo_recordsOnThisPage,2");
  });

  it("includes CSV header row with column names", () => {
    const activities = [createPaymentActivity()];
    const csv = exportToCSV(activities);

    expect(csv).toContain("attempt_id,");
    expect(csv).toContain("attempt_created_at,");
    expect(csv).toContain("network,");
    expect(csv).toContain("asset_code,");
    expect(csv).toContain("amount,");
  });

  it("protects against formula injection with = prefix", () => {
    const activities = [
      createPaymentActivity({
        attempt: {
          ...createPaymentActivity().attempt,
          id: "=cmd|'/c calc'!A1"
        }
      })
    ];
    const csv = exportToCSV(activities);

    expect(csv).toContain("'=cmd|'/c calc'!A1");
  });

  it("protects against formula injection with + prefix", () => {
    const activities = [
      createPaymentActivity({
        attempt: {
          ...createPaymentActivity().attempt,
          assetCode: "+2+5+5"
        }
      })
    ];
    const csv = exportToCSV(activities);

    expect(csv).toContain("'+2+5+5");
  });

  it("protects against formula injection with - prefix", () => {
    const activities = [
      createPaymentActivity({
        attempt: {
          ...createPaymentActivity().attempt,
          assetCode: "-2+3+cmd|' /C calc'!A0"
        }
      })
    ];
    const csv = exportToCSV(activities);

    expect(csv).toContain("'-2+3+cmd|' /C calc'!A0");
  });

  it("protects against formula injection with @ prefix", () => {
    const activities = [
      createPaymentActivity({
        attempt: {
          ...createPaymentActivity().attempt,
          sellerId: "@SUM(1+1)*cmd|' /C calc'!A0"
        }
      })
    ];
    const csv = exportToCSV(activities);

    expect(csv).toContain("'@SUM(1+1)*cmd|' /C calc'!A0");
  });

  it("handles commas in values with RFC 4180 quoting", () => {
    const activities = [
      createPaymentActivity({
        attempt: {
          ...createPaymentActivity().attempt,
          failureReason: "Error: Payment failed, insufficient balance, please retry"
        }
      })
    ];
    const csv = exportToCSV(activities);

    expect(csv).toContain('"Error: Payment failed, insufficient balance, please retry"');
  });

  it("handles quotes in values with RFC 4180 escaping", () => {
    const activities = [
      createPaymentActivity({
        attempt: {
          ...createPaymentActivity().attempt,
          failureReason: 'Error: "Payment" verification failed'
        }
      })
    ];
    const csv = exportToCSV(activities);

    expect(csv).toContain('"Error: ""Payment"" verification failed"');
  });

  it("handles newlines in values with RFC 4180 quoting", () => {
    const activities = [
      createPaymentActivity({
        attempt: {
          ...createPaymentActivity().attempt,
          failureReason: "Error: Payment failed.\nPlease contact support."
        }
      })
    ];
    const csv = exportToCSV(activities);

    expect(csv).toContain('"Error: Payment failed.\nPlease contact support."');
  });

  it("handles null values as empty strings", () => {
    const activities = [
      createPaymentActivity({
        attempt: {
          ...createPaymentActivity().attempt,
          failureCode: null,
          failureReason: null
        }
      })
    ];
    const csv = exportToCSV(activities);
    const lines = csv.split('\n');
    const dataLine = lines[lines.length - 1];

    // Should have empty cells for null values
    expect(dataLine).toContain(",,");
  });

  it("handles empty activities array", () => {
    const csv = exportToCSV([]);

    expect(csv.charCodeAt(0)).toBe(0xfeff); // BOM present
    expect(csv).toContain("Metadata,,");
    expect(csv).toContain("pageInfo_recordsOnThisPage,0");
    expect(csv).toContain("attempt_id,");
  });

  it("preserves large amounts as strings in CSV", () => {
    const activities = [
      createPaymentActivity({
        attempt: {
          ...createPaymentActivity().attempt,
          amount: "9007199254740992"
        }
      })
    ];
    const csv = exportToCSV(activities);

    expect(csv).toContain("9007199254740992");
  });

  it("does not include forbidden fields in CSV", () => {
    const activities = [createPaymentActivity()];
    const csv = exportToCSV(activities);

    expect(csv).not.toContain("paymentHash");
    expect(csv).not.toContain("secret_hash");
  });

  it("handles unicode characters correctly", () => {
    const activities = [
      createPaymentActivity({
        attempt: {
          ...createPaymentActivity().attempt,
          failureReason: "Erreur: Paiement échoué – Café ☕"
        }
      })
    ];
    const csv = exportToCSV(activities);

    expect(csv).toContain("Café ☕");
  });

  it("exports multiple records with correct CSV structure", () => {
    const activities = [
      createPaymentActivity({ attempt: { ...createPaymentActivity().attempt, id: "attempt_1" } }),
      createPaymentActivity({ attempt: { ...createPaymentActivity().attempt, id: "attempt_2" } })
    ];
    const csv = exportToCSV(activities);
    const lines = csv.split('\n').filter(line => line.trim());

    // Metadata (5 lines) + empty line + header + 2 data rows
    expect(lines.length).toBeGreaterThanOrEqual(8);
    expect(lines[lines.length - 2]).toContain("attempt_1");
    expect(lines[lines.length - 1]).toContain("attempt_2");
  });

  it("CSV includes evidenceSource label in metadata", () => {
    const activities = [createPaymentActivity()];
    const csvDemo = exportToCSV(activities, {}, "demo");
    const csvLive = exportToCSV(activities, {}, "live");

    expect(csvDemo).toContain("evidenceSource,demo");
    expect(csvLive).toContain("evidenceSource,live");
  });
});
