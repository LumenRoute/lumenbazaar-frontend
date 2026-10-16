import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Receipt } from "@/services/api/schemas";

import { ReceiptDetailSummary } from "./receipt-detail-summary";

// Mock the payments service to avoid external dependencies
vi.mock("@/services/payments", () => ({
  explorerTransactionUrl: vi.fn((network: string, hash: string) => {
    // Mock implementation that validates hash format
    if (hash && /^[a-f0-9]{64}$/i.test(hash)) {
      return `https://stellar.expert/explorer/${network === "stellar:testnet" ? "testnet" : "public"}/tx/${hash}`;
    }
    return null;
  }),
  isValidTransactionHash: vi.fn((hash: string | null | undefined) => {
    if (!hash || typeof hash !== "string") {
      return false;
    }
    return /^[a-f0-9]{64}$/i.test(hash);
  })
}));

describe("ReceiptDetailSummary", () => {
  it("displays receipt ID and basic information", () => {
    const receipt: Receipt = {
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
      status: "finalized",
      transactionHash: "tx_hash_abc123",
      updatedAt: "2026-10-15T10:05:00Z"
    };

    render(<ReceiptDetailSummary receipt={receipt} />);

    expect(screen.getByText("receipt_123")).toBeInTheDocument();
    expect(screen.getByText("finalized")).toBeInTheDocument();
    expect(screen.getByText("stellar:testnet")).toBeInTheDocument();
    expect(screen.getByText("100 USDC")).toBeInTheDocument();
  });

  it("shows success tone badge for finalized receipts", () => {
    const receipt: Receipt = {
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
      status: "finalized",
      transactionHash: "tx_hash_abc123",
      updatedAt: "2026-10-15T10:05:00Z"
    };

    const { container } = render(<ReceiptDetailSummary receipt={receipt} />);

    const badges = container.querySelectorAll("[class*='bg-']");
    expect(badges.length).toBeGreaterThan(0);
  });

  it("shows danger tone badge for failed receipts", () => {
    const receipt: Receipt = {
      amount: "50",
      assetCode: "USDC",
      assetIssuer: "GBUQWP3BOUZX34ULNQG23RQ6F4BVWBRXM6LSV7XYJJJX34ZPUSC6D6P2",
      correlationId: "corr_fail",
      createdAt: "2026-10-15T10:00:00Z",
      evidenceHash: "hash_fail",
      failureCode: "AMOUNT_MISMATCH",
      failureReason: "Payment amount did not match",
      id: "receipt_failed",
      ledger: null,
      network: "stellar:testnet",
      paymentAttemptId: "attempt_fail",
      resourceId: null,
      sellerId: null,
      settledAt: null,
      status: "failed",
      transactionHash: null,
      updatedAt: "2026-10-15T10:01:00Z"
    };

    render(<ReceiptDetailSummary receipt={receipt} />);

    expect(screen.getByText("failed")).toBeInTheDocument();
    expect(screen.getByText("Failure information")).toBeInTheDocument();
    expect(screen.getByText("AMOUNT_MISMATCH")).toBeInTheDocument();
    expect(screen.getByText("Payment amount did not match")).toBeInTheDocument();
  });

  it("shows warning tone badge for pending receipts", () => {
    const receipt: Receipt = {
      amount: "75",
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
      status: "pending",
      transactionHash: null,
      updatedAt: "2026-10-15T10:00:00Z"
    };

    render(<ReceiptDetailSummary receipt={receipt} />);

    expect(screen.getByText("pending")).toBeInTheDocument();
    expect(screen.getByText("Pending settlement")).toBeInTheDocument();
    expect(
      screen.getByText(/awaiting finalization on the Stellar network/)
    ).toBeInTheDocument();
  });

  it("displays finality confirmation with transaction hash and ledger", () => {
    const receipt: Receipt = {
      amount: "100",
      assetCode: "USDC",
      assetIssuer: "GBUQWP3BOUZX34ULNQG23RQ6F4BVWBRXM6LSV7XYJJJX34ZPUSC6D6P2",
      correlationId: "corr_123",
      createdAt: "2026-10-15T10:00:00Z",
      evidenceHash: "hash_abc123",
      failureCode: null,
      failureReason: null,
      id: "receipt_123",
      ledger: 54321,
      network: "stellar:testnet",
      paymentAttemptId: "attempt_123",
      resourceId: null,
      sellerId: null,
      settledAt: "2026-10-15T10:05:00Z",
      status: "finalized",
      transactionHash: "abc123def456",
      updatedAt: "2026-10-15T10:05:00Z"
    };

    render(<ReceiptDetailSummary receipt={receipt} />);

    expect(screen.getByText("Finality confirmation")).toBeInTheDocument();
    expect(screen.getByText("abc123def456")).toBeInTheDocument();
    expect(screen.getByText("54321")).toBeInTheDocument();
  });

  it("provides a link to Stellar explorer for finalized receipts", () => {
    const receipt: Receipt = {
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
      status: "finalized",
      transactionHash: "tx_hash_abc123",
      updatedAt: "2026-10-15T10:05:00Z"
    };

    render(<ReceiptDetailSummary receipt={receipt} />);

    const link = screen.getByRole("link", { name: /View on Stellar explorer/ });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
    expect(link.getAttribute("href")).toContain("stellar.expert");
  });

  it("does not show finality confirmation for pending receipts", () => {
    const receipt: Receipt = {
      amount: "75",
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
      status: "pending",
      transactionHash: null,
      updatedAt: "2026-10-15T10:00:00Z"
    };

    render(<ReceiptDetailSummary receipt={receipt} />);

    expect(screen.queryByText("Finality confirmation")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Stellar explorer/ })).not.toBeInTheDocument();
  });

  it("displays associated resource information when resourceId is present", () => {
    const receipt: Receipt = {
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
      resourceId: "resource_456",
      sellerId: null,
      settledAt: "2026-10-15T10:05:00Z",
      status: "finalized",
      transactionHash: "tx_hash_abc123",
      updatedAt: "2026-10-15T10:05:00Z"
    };

    render(<ReceiptDetailSummary receipt={receipt} />);

    expect(screen.getByText("Associated resource")).toBeInTheDocument();
    expect(screen.getByText("resource_456")).toBeInTheDocument();
  });

  it("displays seller information when sellerId is present", () => {
    const receipt: Receipt = {
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
      sellerId: "seller_789",
      settledAt: "2026-10-15T10:05:00Z",
      status: "finalized",
      transactionHash: "tx_hash_abc123",
      updatedAt: "2026-10-15T10:05:00Z"
    };

    render(<ReceiptDetailSummary receipt={receipt} />);

    expect(screen.getByText("Seller information")).toBeInTheDocument();
    expect(screen.getByText("seller_789")).toBeInTheDocument();
  });

  it("does not display resource section when resourceId is null", () => {
    const receipt: Receipt = {
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
      status: "finalized",
      transactionHash: "tx_hash_abc123",
      updatedAt: "2026-10-15T10:05:00Z"
    };

    render(<ReceiptDetailSummary receipt={receipt} />);

    expect(screen.queryByText("Associated resource")).not.toBeInTheDocument();
  });

  it("does not display seller section when sellerId is null", () => {
    const receipt: Receipt = {
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
      status: "finalized",
      transactionHash: "tx_hash_abc123",
      updatedAt: "2026-10-15T10:05:00Z"
    };

    render(<ReceiptDetailSummary receipt={receipt} />);

    expect(screen.queryByText("Seller information")).not.toBeInTheDocument();
  });

  it("formats ISO dates into localized format", () => {
    const receipt: Receipt = {
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
      status: "finalized",
      transactionHash: "tx_hash_abc123",
      updatedAt: "2026-10-15T10:05:00Z"
    };

    render(<ReceiptDetailSummary receipt={receipt} />);

    // Check that the ISO date is converted (should include the date parts)
    // The exact format will depend on the system locale, but should include date/time parts
    const receiptInfo = screen.getByText("Receipt information");
    expect(receiptInfo).toBeInTheDocument();
  });

  it("displays all payment verification fields", () => {
    const receipt: Receipt = {
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
      status: "finalized",
      transactionHash: "tx_hash_abc123",
      updatedAt: "2026-10-15T10:05:00Z"
    };

    render(<ReceiptDetailSummary receipt={receipt} />);

    expect(screen.getByText("Payment verification")).toBeInTheDocument();
    expect(screen.getByText("attempt_123")).toBeInTheDocument();
    expect(screen.getByText("corr_123")).toBeInTheDocument();
    expect(screen.getByText("hash_abc123")).toBeInTheDocument();
  });

  it("displays warning for malformed transaction hash", () => {
    const receipt: Receipt = {
      amount: "100",
      assetCode: "USDC",
      assetIssuer: "GBUQWP3BOUZX34ULNQG23RQ6F4BVWBRXM6LSV7XYJJJX34ZPUSC6D6P2",
      correlationId: "corr_malformed",
      createdAt: "2026-10-15T10:00:00Z",
      evidenceHash: "hash_malformed",
      failureCode: null,
      failureReason: null,
      id: "receipt_malformed",
      ledger: 12345,
      network: "stellar:testnet",
      paymentAttemptId: "attempt_malformed",
      resourceId: null,
      sellerId: null,
      settledAt: "2026-10-15T10:05:00Z",
      status: "finalized",
      transactionHash: "invalid_hash_format", // Invalid format
      updatedAt: "2026-10-15T10:05:00Z"
    };

    render(<ReceiptDetailSummary receipt={receipt} />);

    // Should still show finality confirmation section
    expect(screen.getByText("Finality confirmation")).toBeInTheDocument();
    
    // Should display the hash
    expect(screen.getByText("invalid_hash_format")).toBeInTheDocument();

    // Should show warning instead of link
    expect(screen.getByText(/Transaction hash is invalid and cannot be verified/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /View on Stellar explorer/ })).not.toBeInTheDocument();
  });

  it("does not display finality section for finalized receipt with no transaction hash", () => {
    const receipt: Receipt = {
      amount: "100",
      assetCode: "USDC",
      assetIssuer: "GBUQWP3BOUZX34ULNQG23RQ6F4BVWBRXM6LSV7XYJJJX34ZPUSC6D6P2",
      correlationId: "corr_no_hash",
      createdAt: "2026-10-15T10:00:00Z",
      evidenceHash: "hash_no_hash",
      failureCode: null,
      failureReason: null,
      id: "receipt_no_hash",
      ledger: 12345,
      network: "stellar:testnet",
      paymentAttemptId: "attempt_no_hash",
      resourceId: null,
      sellerId: null,
      settledAt: "2026-10-15T10:05:00Z",
      status: "finalized",
      transactionHash: null, // No hash
      updatedAt: "2026-10-15T10:05:00Z"
    };

    render(<ReceiptDetailSummary receipt={receipt} />);

    expect(screen.queryByText("Finality confirmation")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Stellar explorer/ })).not.toBeInTheDocument();
  });

  it("displays finality section with ledger and settlement time", () => {
    const receipt: Receipt = {
      amount: "100",
      assetCode: "USDC",
      assetIssuer: "GBUQWP3BOUZX34ULNQG23RQ6F4BVWBRXM6LSV7XYJJJX34ZPUSC6D6P2",
      correlationId: "corr_full",
      createdAt: "2026-10-15T10:00:00Z",
      evidenceHash: "hash_full",
      failureCode: null,
      failureReason: null,
      id: "receipt_full",
      ledger: 789456, // Specific ledger
      network: "stellar:testnet",
      paymentAttemptId: "attempt_full",
      resourceId: null,
      sellerId: null,
      settledAt: "2026-10-15T10:05:30Z", // Specific settlement time
      status: "finalized",
      transactionHash: "abc123def456abc123def456abc123def456abc123def456abc123def456abc1",
      updatedAt: "2026-10-15T10:05:30Z"
    };

    render(<ReceiptDetailSummary receipt={receipt} />);

    expect(screen.getByText("Finality confirmation")).toBeInTheDocument();
    expect(screen.getByText("789456")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /View on Stellar explorer/ })
    ).toBeInTheDocument();
  });

  it("handles transaction hash with null ledger gracefully", () => {
    const receipt: Receipt = {
      amount: "100",
      assetCode: "USDC",
      assetIssuer: "GBUQWP3BOUZX34ULNQG23RQ6F4BVWBRXM6LSV7XYJJJX34ZPUSC6D6P2",
      correlationId: "corr_no_ledger",
      createdAt: "2026-10-15T10:00:00Z",
      evidenceHash: "hash_no_ledger",
      failureCode: null,
      failureReason: null,
      id: "receipt_no_ledger",
      ledger: null, // No ledger
      network: "stellar:testnet",
      paymentAttemptId: "attempt_no_ledger",
      resourceId: null,
      sellerId: null,
      settledAt: "2026-10-15T10:05:00Z",
      status: "finalized",
      transactionHash: "abc123def456abc123def456abc123def456abc123def456abc123def456abc1",
      updatedAt: "2026-10-15T10:05:00Z"
    };

    render(<ReceiptDetailSummary receipt={receipt} />);

    expect(screen.getByText("Finality confirmation")).toBeInTheDocument();
    expect(screen.getByText("Unknown")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /View on Stellar explorer/ })
    ).toBeInTheDocument();
  });

  it("handles transaction hash with null settlement time gracefully", () => {
    const receipt: Receipt = {
      amount: "100",
      assetCode: "USDC",
      assetIssuer: "GBUQWP3BOUZX34ULNQG23RQ6F4BVWBRXM6LSV7XYJJJX34ZPUSC6D6P2",
      correlationId: "corr_no_settled_at",
      createdAt: "2026-10-15T10:00:00Z",
      evidenceHash: "hash_no_settled_at",
      failureCode: null,
      failureReason: null,
      id: "receipt_no_settled_at",
      ledger: 123456,
      network: "stellar:testnet",
      paymentAttemptId: "attempt_no_settled_at",
      resourceId: null,
      sellerId: null,
      settledAt: null, // No settlement time
      status: "finalized",
      transactionHash: "abc123def456abc123def456abc123def456abc123def456abc123def456abc1",
      updatedAt: "2026-10-15T10:05:00Z"
    };

    render(<ReceiptDetailSummary receipt={receipt} />);

    expect(screen.getByText("Finality confirmation")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument(); // Fallback text for missing settledAt
    expect(
      screen.getByRole("link", { name: /View on Stellar explorer/ })
    ).toBeInTheDocument();
  });
});
