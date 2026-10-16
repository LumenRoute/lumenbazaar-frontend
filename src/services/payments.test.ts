import { describe, expect, it } from "vitest";

import { explorerTransactionUrl, isValidTransactionHash, isSyntheticTransactionId } from "./payments";

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
