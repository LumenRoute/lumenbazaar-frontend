import { describe, expect, it } from "vitest";

import { explorerTransactionUrl, isValidTransactionHash } from "./payments";

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
