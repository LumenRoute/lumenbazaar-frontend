import { describe, expect, it } from "vitest";
import { z } from "zod";

import { receiptSchema, settlementSchema } from "./schemas";

describe("Schema validation for transaction hashes", () => {
  describe("receiptSchema transactionHash validation", () => {
    it("accepts valid 64-character hex transaction hashes", () => {
      const validReceipt = {
        amount: "100",
        assetCode: "USDC",
        assetIssuer: "GBUQWP3BOUZX34ULNQG23RQ6F4BVWBRXM6LSV7XYJJJX34ZPUSC6D6P2",
        correlationId: "corr_123",
        createdAt: "2026-10-15T10:00:00Z",
        evidenceHash: "hash_abc123",
        failureCode: null,
        failureReason: null,
        id: "receipt_123",
        ledger: 12345,
        network: "stellar:testnet",
        paymentAttemptId: "attempt_123",
        resourceId: null,
        sellerId: null,
        settledAt: "2026-10-15T10:05:00Z",
        status: "finalized" as const,
        transactionHash: "8b54ad6f02d48fef51d92f2db1a4d4d069e9449ce9a4f27b9a6c6e6d88f9d631",
        updatedAt: "2026-10-15T10:05:00Z"
      };

      const result = receiptSchema.safeParse(validReceipt);
      expect(result.success).toBe(true);
    });

    it("accepts uppercase 64-character hex transaction hashes", () => {
      const validReceipt = {
        amount: "100",
        assetCode: "USDC",
        assetIssuer: "GBUQWP3BOUZX34ULNQG23RQ6F4BVWBRXM6LSV7XYJJJX34ZPUSC6D6P2",
        correlationId: "corr_123",
        createdAt: "2026-10-15T10:00:00Z",
        evidenceHash: "hash_abc123",
        failureCode: null,
        failureReason: null,
        id: "receipt_123",
        ledger: 12345,
        network: "stellar:testnet",
        paymentAttemptId: "attempt_123",
        resourceId: null,
        sellerId: null,
        settledAt: "2026-10-15T10:05:00Z",
        status: "finalized" as const,
        transactionHash: "8B54AD6F02D48FEF51D92F2DB1A4D4D069E9449CE9A4F27B9A6C6E6D88F9D631",
        updatedAt: "2026-10-15T10:05:00Z"
      };

      const result = receiptSchema.safeParse(validReceipt);
      expect(result.success).toBe(true);
    });

    it("accepts null transaction hash for pending receipts", () => {
      const pendingReceipt = {
        amount: "100",
        assetCode: "USDC",
        assetIssuer: "GBUQWP3BOUZX34ULNQG23RQ6F4BVWBRXM6LSV7XYJJJX34ZPUSC6D6P2",
        correlationId: "corr_pending",
        createdAt: "2026-10-15T10:00:00Z",
        evidenceHash: "hash_pending",
        failureCode: null,
        failureReason: null,
        id: "receipt_pending",
        ledger: null,
        network: "stellar:testnet",
        paymentAttemptId: "attempt_pending",
        resourceId: null,
        sellerId: null,
        settledAt: null,
        status: "pending" as const,
        transactionHash: null,
        updatedAt: "2026-10-15T10:00:00Z"
      };

      const result = receiptSchema.safeParse(pendingReceipt);
      expect(result.success).toBe(true);
    });

    it("rejects upto-* prefixed synthetic identifiers", () => {
      const syntheticReceipt = {
        amount: "100",
        assetCode: "USDC",
        assetIssuer: "GBUQWP3BOUZX34ULNQG23RQ6F4BVWBRXM6LSV7XYJJJX34ZPUSC6D6P2",
        correlationId: "corr_upto",
        createdAt: "2026-10-15T10:00:00Z",
        evidenceHash: "hash_upto",
        failureCode: null,
        failureReason: null,
        id: "receipt_upto",
        ledger: 12345,
        network: "stellar:testnet",
        paymentAttemptId: "attempt_upto",
        resourceId: null,
        sellerId: null,
        settledAt: "2026-10-15T10:05:00Z",
        status: "finalized" as const,
        transactionHash: "upto-settle",
        updatedAt: "2026-10-15T10:05:00Z"
      };

      const result = receiptSchema.safeParse(syntheticReceipt);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("64-character hexadecimal");
      }
    });

    it("rejects exact-* prefixed synthetic identifiers", () => {
      const syntheticReceipt = {
        amount: "100",
        assetCode: "USDC",
        assetIssuer: "GBUQWP3BOUZX34ULNQG23RQ6F4BVWBRXM6LSV7XYJJJX34ZPUSC6D6P2",
        correlationId: "corr_exact",
        createdAt: "2026-10-15T10:00:00Z",
        evidenceHash: "hash_exact",
        failureCode: null,
        failureReason: null,
        id: "receipt_exact",
        ledger: 12345,
        network: "stellar:testnet",
        paymentAttemptId: "attempt_exact",
        resourceId: null,
        sellerId: null,
        settledAt: "2026-10-15T10:05:00Z",
        status: "finalized" as const,
        transactionHash: "exact-verify",
        updatedAt: "2026-10-15T10:05:00Z"
      };

      const result = receiptSchema.safeParse(syntheticReceipt);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("64-character hexadecimal");
      }
    });

    it("rejects playground_* prefixed synthetic identifiers", () => {
      const syntheticReceipt = {
        amount: "100",
        assetCode: "USDC",
        assetIssuer: "GBUQWP3BOUZX34ULNQG23RQ6F4BVWBRXM6LSV7XYJJJX34ZPUSC6D6P2",
        correlationId: "corr_playground",
        createdAt: "2026-10-15T10:00:00Z",
        evidenceHash: "hash_playground",
        failureCode: null,
        failureReason: null,
        id: "receipt_playground",
        ledger: 12345,
        network: "stellar:testnet",
        paymentAttemptId: "attempt_playground",
        resourceId: null,
        sellerId: null,
        settledAt: "2026-10-15T10:05:00Z",
        status: "finalized" as const,
        transactionHash: "playground_settlement_123",
        updatedAt: "2026-10-15T10:05:00Z"
      };

      const result = receiptSchema.safeParse(syntheticReceipt);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("64-character hexadecimal");
      }
    });

    it("rejects too-short hashes (63 characters)", () => {
      const invalidReceipt = {
        amount: "100",
        assetCode: "USDC",
        assetIssuer: "GBUQWP3BOUZX34ULNQG23RQ6F4BVWBRXM6LSV7XYJJJX34ZPUSC6D6P2",
        correlationId: "corr_short",
        createdAt: "2026-10-15T10:00:00Z",
        evidenceHash: "hash_short",
        failureCode: null,
        failureReason: null,
        id: "receipt_short",
        ledger: 12345,
        network: "stellar:testnet",
        paymentAttemptId: "attempt_short",
        resourceId: null,
        sellerId: null,
        settledAt: "2026-10-15T10:05:00Z",
        status: "finalized" as const,
        transactionHash: "8b54ad6f02d48fef51d92f2db1a4d4d069e9449ce9a4f27b9a6c6e6d88f9d63",
        updatedAt: "2026-10-15T10:05:00Z"
      };

      const result = receiptSchema.safeParse(invalidReceipt);
      expect(result.success).toBe(false);
    });

    it("rejects too-long hashes (65 characters)", () => {
      const invalidReceipt = {
        amount: "100",
        assetCode: "USDC",
        assetIssuer: "GBUQWP3BOUZX34ULNQG23RQ6F4BVWBRXM6LSV7XYJJJX34ZPUSC6D6P2",
        correlationId: "corr_long",
        createdAt: "2026-10-15T10:00:00Z",
        evidenceHash: "hash_long",
        failureCode: null,
        failureReason: null,
        id: "receipt_long",
        ledger: 12345,
        network: "stellar:testnet",
        paymentAttemptId: "attempt_long",
        resourceId: null,
        sellerId: null,
        settledAt: "2026-10-15T10:05:00Z",
        status: "finalized" as const,
        transactionHash: "8b54ad6f02d48fef51d92f2db1a4d4d069e9449ce9a4f27b9a6c6e6d88f9d6311",
        updatedAt: "2026-10-15T10:05:00Z"
      };

      const result = receiptSchema.safeParse(invalidReceipt);
      expect(result.success).toBe(false);
    });

    it("rejects hashes with invalid hex characters", () => {
      const invalidReceipt = {
        amount: "100",
        assetCode: "USDC",
        assetIssuer: "GBUQWP3BOUZX34ULNQG23RQ6F4BVWBRXM6LSV7XYJJJX34ZPUSC6D6P2",
        correlationId: "corr_invalid_char",
        createdAt: "2026-10-15T10:00:00Z",
        evidenceHash: "hash_invalid_char",
        failureCode: null,
        failureReason: null,
        id: "receipt_invalid_char",
        ledger: 12345,
        network: "stellar:testnet",
        paymentAttemptId: "attempt_invalid_char",
        resourceId: null,
        sellerId: null,
        settledAt: "2026-10-15T10:05:00Z",
        status: "finalized" as const,
        transactionHash: "8b54ad6f02d48fef51d92f2db1a4d4d069e9449ce9a4f27b9a6c6e6d88f9d63g",
        updatedAt: "2026-10-15T10:05:00Z"
      };

      const result = receiptSchema.safeParse(invalidReceipt);
      expect(result.success).toBe(false);
    });

    it("rejects hashes with spaces", () => {
      const invalidReceipt = {
        amount: "100",
        assetCode: "USDC",
        assetIssuer: "GBUQWP3BOUZX34ULNQG23RQ6F4BVWBRXM6LSV7XYJJJX34ZPUSC6D6P2",
        correlationId: "corr_space",
        createdAt: "2026-10-15T10:00:00Z",
        evidenceHash: "hash_space",
        failureCode: null,
        failureReason: null,
        id: "receipt_space",
        ledger: 12345,
        network: "stellar:testnet",
        paymentAttemptId: "attempt_space",
        resourceId: null,
        sellerId: null,
        settledAt: "2026-10-15T10:05:00Z",
        status: "finalized" as const,
        transactionHash: "8b54ad6f02d48fef51d92f2db1a4d4d069e9449ce9a4f27b9a6c6e6d88f9d63 ",
        updatedAt: "2026-10-15T10:05:00Z"
      };

      const result = receiptSchema.safeParse(invalidReceipt);
      expect(result.success).toBe(false);
    });
  });

  describe("settlementSchema transactionHash validation", () => {
    it("accepts valid 64-character hex transaction hashes in settlement", () => {
      const validSettlement = {
        amount: "100",
        errorMessage: undefined,
        errorReason: undefined,
        extensionResponses: undefined,
        extensions: undefined,
        extra: {
          lumenbazaar: {
            correlationId: "corr_settlement",
            ledger: 54321,
            paymentAttemptId: "attempt_settlement",
            receiptId: "receipt_settlement",
            settlementId: "settlement_123",
            status: "confirmed" as const,
            transactionHash: "8b54ad6f02d48fef51d92f2db1a4d4d069e9449ce9a4f27b9a6c6e6d88f9d631"
          }
        },
        network: "stellar:testnet",
        payer: undefined,
        success: true,
        transaction: "transaction_xdr"
      };

      const result = settlementSchema.safeParse(validSettlement);
      expect(result.success).toBe(true);
    });

    it("rejects upto-* prefixed identifiers in settlement transactionHash", () => {
      const invalidSettlement = {
        amount: "100",
        errorMessage: undefined,
        errorReason: undefined,
        extensionResponses: undefined,
        extensions: undefined,
        extra: {
          lumenbazaar: {
            correlationId: "corr_settlement",
            ledger: 54321,
            paymentAttemptId: "attempt_settlement",
            receiptId: "receipt_settlement",
            settlementId: "settlement_123",
            status: "confirmed" as const,
            transactionHash: "upto-settle"
          }
        },
        network: "stellar:testnet",
        payer: undefined,
        success: true,
        transaction: "transaction_xdr"
      };

      const result = settlementSchema.safeParse(invalidSettlement);
      expect(result.success).toBe(false);
    });

    it("rejects exact-* prefixed identifiers in settlement transactionHash", () => {
      const invalidSettlement = {
        amount: "100",
        errorMessage: undefined,
        errorReason: undefined,
        extensionResponses: undefined,
        extensions: undefined,
        extra: {
          lumenbazaar: {
            correlationId: "corr_settlement",
            ledger: 54321,
            paymentAttemptId: "attempt_settlement",
            receiptId: "receipt_settlement",
            settlementId: "settlement_123",
            status: "confirmed" as const,
            transactionHash: "exact-verify"
          }
        },
        network: "stellar:testnet",
        payer: undefined,
        success: true,
        transaction: "transaction_xdr"
      };

      const result = settlementSchema.safeParse(invalidSettlement);
      expect(result.success).toBe(false);
    });

    it("rejects playground_* prefixed identifiers in settlement transactionHash", () => {
      const invalidSettlement = {
        amount: "100",
        errorMessage: undefined,
        errorReason: undefined,
        extensionResponses: undefined,
        extensions: undefined,
        extra: {
          lumenbazaar: {
            correlationId: "corr_settlement",
            ledger: 54321,
            paymentAttemptId: "attempt_settlement",
            receiptId: "receipt_settlement",
            settlementId: "settlement_123",
            status: "confirmed" as const,
            transactionHash: "playground_settlement_456"
          }
        },
        network: "stellar:testnet",
        payer: undefined,
        success: true,
        transaction: "transaction_xdr"
      };

      const result = settlementSchema.safeParse(invalidSettlement);
      expect(result.success).toBe(false);
    });

    it("rejects non-hex transaction hash in settlement", () => {
      const invalidSettlement = {
        amount: "100",
        errorMessage: undefined,
        errorReason: undefined,
        extensionResponses: undefined,
        extensions: undefined,
        extra: {
          lumenbazaar: {
            correlationId: "corr_settlement",
            ledger: 54321,
            paymentAttemptId: "attempt_settlement",
            receiptId: "receipt_settlement",
            settlementId: "settlement_123",
            status: "confirmed" as const,
            transactionHash: "not-a-valid-hex-string-at-all"
          }
        },
        network: "stellar:testnet",
        payer: undefined,
        success: true,
        transaction: "transaction_xdr"
      };

      const result = settlementSchema.safeParse(invalidSettlement);
      expect(result.success).toBe(false);
    });

    it("provides clear error message for invalid transaction hash", () => {
      const invalidSettlement = {
        amount: "100",
        errorMessage: undefined,
        errorReason: undefined,
        extensionResponses: undefined,
        extensions: undefined,
        extra: {
          lumenbazaar: {
            correlationId: "corr_settlement",
            ledger: 54321,
            paymentAttemptId: "attempt_settlement",
            receiptId: "receipt_settlement",
            settlementId: "settlement_123",
            status: "confirmed" as const,
            transactionHash: "invalid_tx_hash"
          }
        },
        network: "stellar:testnet",
        payer: undefined,
        success: true,
        transaction: "transaction_xdr"
      };

      const result = settlementSchema.safeParse(invalidSettlement);
      expect(result.success).toBe(false);
      if (!result.success) {
        const hashError = result.error.issues.find((issue) =>
          issue.path.includes("transactionHash")
        );
        expect(hashError?.message).toContain("64-character hexadecimal");
      }
    });
  });

  describe("boundary cases for transaction hash validation", () => {
    it("accepts all-zero 64-char hash", () => {
      const validReceipt = {
        amount: "100",
        assetCode: "USDC",
        assetIssuer: "GBUQWP3BOUZX34ULNQG23RQ6F4BVWBRXM6LSV7XYJJJX34ZPUSC6D6P2",
        correlationId: "corr_zero",
        createdAt: "2026-10-15T10:00:00Z",
        evidenceHash: "hash_zero",
        failureCode: null,
        failureReason: null,
        id: "receipt_zero",
        ledger: 12345,
        network: "stellar:testnet",
        paymentAttemptId: "attempt_zero",
        resourceId: null,
        sellerId: null,
        settledAt: "2026-10-15T10:05:00Z",
        status: "finalized" as const,
        transactionHash: "0000000000000000000000000000000000000000000000000000000000000000",
        updatedAt: "2026-10-15T10:05:00Z"
      };

      const result = receiptSchema.safeParse(validReceipt);
      expect(result.success).toBe(true);
    });

    it("accepts all-f 64-char hash", () => {
      const validReceipt = {
        amount: "100",
        assetCode: "USDC",
        assetIssuer: "GBUQWP3BOUZX34ULNQG23RQ6F4BVWBRXM6LSV7XYJJJX34ZPUSC6D6P2",
        correlationId: "corr_f",
        createdAt: "2026-10-15T10:00:00Z",
        evidenceHash: "hash_f",
        failureCode: null,
        failureReason: null,
        id: "receipt_f",
        ledger: 12345,
        network: "stellar:testnet",
        paymentAttemptId: "attempt_f",
        resourceId: null,
        sellerId: null,
        settledAt: "2026-10-15T10:05:00Z",
        status: "finalized" as const,
        transactionHash: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        updatedAt: "2026-10-15T10:05:00Z"
      };

      const result = receiptSchema.safeParse(validReceipt);
      expect(result.success).toBe(true);
    });

    it("accepts mixed-case valid hex hash", () => {
      const validReceipt = {
        amount: "100",
        assetCode: "USDC",
        assetIssuer: "GBUQWP3BOUZX34ULNQG23RQ6F4BVWBRXM6LSV7XYJJJX34ZPUSC6D6P2",
        correlationId: "corr_mixed",
        createdAt: "2026-10-15T10:00:00Z",
        evidenceHash: "hash_mixed",
        failureCode: null,
        failureReason: null,
        id: "receipt_mixed",
        ledger: 12345,
        network: "stellar:testnet",
        paymentAttemptId: "attempt_mixed",
        resourceId: null,
        sellerId: null,
        settledAt: "2026-10-15T10:05:00Z",
        status: "finalized" as const,
        transactionHash: "AbCdEf1234567890AbCdEf1234567890AbCdEf1234567890AbCdEf1234567890",
        updatedAt: "2026-10-15T10:05:00Z"
      };

      const result = receiptSchema.safeParse(validReceipt);
      expect(result.success).toBe(true);
    });
  });
});
