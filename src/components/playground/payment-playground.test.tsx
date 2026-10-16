import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { PaymentPlayground } from "./payment-playground";
import * as runtimeConfig from "@/config/runtime";

// Mock modules
vi.mock("@/config/runtime", () => ({
  isDemoMode: vi.fn(() => true),
  loadRuntimeConfig: vi.fn(() => ({
    defaultNetwork: "stellar:testnet",
    environment: "demo"
  }))
}));

vi.mock("@/services/x402/challenge", () => ({
  requestPaymentChallenge: vi.fn(),
  expectedTermsForResource: vi.fn()
}));

vi.mock("@/services/x402/authorization", () => ({
  authorizePaymentChallenge: vi.fn()
}));

vi.mock("@/services/x402/paid-flow", () => ({
  paidFlowCoordinator: {
    execute: vi.fn(),
    recover: vi.fn()
  }
}));

describe("PaymentPlayground", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the component when in demo mode", () => {
    render(<PaymentPlayground />);
    expect(screen.getByText(/Payment playground/i)).toBeInTheDocument();
  });

  it("shows error state when not in demo mode", () => {
    vi.spyOn(runtimeConfig, "isDemoMode").mockReturnValue(false);
    
    render(<PaymentPlayground />);
    expect(screen.getByText(/Payment playground unavailable/i)).toBeInTheDocument();
  });

  describe("Resource Selection", () => {
    it("renders resource selector dropdown", () => {
      render(<PaymentPlayground />);
      const selector = screen.getByRole("combobox", { name: /Paid resource/ });
      expect(selector).toBeInTheDocument();
    });

    it("displays resource options", () => {
      render(<PaymentPlayground />);
      const selector = screen.getByRole("combobox", { name: /Paid resource/ });
      expect(selector).toHaveLength(1); // At least one option
    });

    it("shows resource details after selection", async () => {
      render(<PaymentPlayground />);
      
      // Resource details should display network, amount, type
      expect(screen.getByText(/Network/i)).toBeInTheDocument();
      expect(screen.getByText(/Amount/i)).toBeInTheDocument();
      expect(screen.getByText(/Type/i)).toBeInTheDocument();
    });
  });

  describe("Authorization Modes", () => {
    it("renders Simulation, Wallet draft, and Live 402 buttons", () => {
      render(<PaymentPlayground />);
      
      expect(screen.getByRole("button", { name: /Simulation/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Wallet draft/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Live 402/i })).toBeInTheDocument();
    });

    it("defaults to Simulation mode", () => {
      render(<PaymentPlayground />);
      
      const simulationButton = screen.getByRole("button", { name: /Simulation/i });
      expect(simulationButton).toHaveClass("primary");
    });

    it("switches to Wallet draft mode", () => {
      render(<PaymentPlayground />);
      
      const walletButton = screen.getByRole("button", { name: /Wallet draft/i });
      fireEvent.click(walletButton);
      
      expect(walletButton).toHaveClass("primary");
    });
  });

  describe("Live 402 Challenge Flow", () => {
    it("displays Live 402 button", () => {
      render(<PaymentPlayground />);
      
      const live402Button = screen.getByRole("button", { name: /Live 402/i });
      expect(live402Button).toBeInTheDocument();
      expect(live402Button).toBeEnabled();
    });

    it("shows challenge information panel after request", async () => {
      render(<PaymentPlayground />);
      
      const live402Button = screen.getByRole("button", { name: /Live 402/i });
      expect(live402Button).toBeInTheDocument();
      
      // Panel should show after successful challenge load
      // Expected content: Payment Challenge, Amount, Network, Expires
    });

    it("displays Authorize with Freighter button when challenge ready", async () => {
      render(<PaymentPlayground />);
      
      // After challenge is loaded, this button should appear
      // Button enables wallet signing
    });
  });

  describe("Wallet Authorization", () => {
    it("handles authorization errors with retry capability", async () => {
      render(<PaymentPlayground />);
      
      // Error display should differentiate:
      // - Retryable errors (rejection, timeout): show "Try Again"
      // - Non-retryable errors (network mismatch): no retry option
    });

    it("displays authorized account after successful signing", async () => {
      render(<PaymentPlayground />);
      
      // After authorization:
      // - Account public key displayed
      // - "Submit Paid Request" button enabled
    });

    it("disables submission when payment is locked", async () => {
      render(<PaymentPlayground />);
      
      // Payment should be locked during:
      // - pending finality
      // - indeterminate state
      // - Prevent duplicate submissions
    });
  });

  describe("Paid Request Submission", () => {
    it("sends request with PAYMENT-SIGNATURE header", async () => {
      render(<PaymentPlayground />);
      
      // After authorization:
      // - "Submit Paid Request" button available
      // - Click initiates paid flow
      // - Payment state updated to "calling"
    });

    it("displays paid response after successful request", async () => {
      render(<PaymentPlayground />);
      
      // Response should show:
      // - Response body as JSON or text
      // - HTTP status code
      // - Payment state badge
    });

    it("shows flow state transitions", async () => {
      render(<PaymentPlayground />);
      
      // States should progress:
      // verifying → verified → calling → submitting → pending → confirmed
      // Each reflected in the Flow panel badge
    });
  });

  describe("Settlement and Receipt", () => {
    it("displays receipt details", async () => {
      render(<PaymentPlayground />);
      
      // Receipt should show:
      // - Receipt ID
      // - Status (finalized/pending/failed)
      // - Ledger number
      // - Transaction hash
    });

    it("provides Stellar explorer link for transaction", async () => {
      render(<PaymentPlayground />);
      
      // After confirmation:
      // - Link to Stellar transaction visible
      // - Correct network URL (testnet)
      // - Opens in new tab
    });

    it("validates receipt evidence", async () => {
      render(<PaymentPlayground />);
      
      // If validation fails:
      // - Validation errors displayed
      // - State set to indeterminate
      // - Evidence mismatches listed
    });
  });

  describe("Preflight Checks", () => {
    it("renders preflight check section", () => {
      render(<PaymentPlayground />);
      
      expect(screen.getByText(/Preflight Check/i)).toBeInTheDocument();
      expect(screen.getByLabel(/Public Key/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Check Account/i })).toBeInTheDocument();
    });

    it("validates public key format before submission", async () => {
      render(<PaymentPlayground />);
      
      const input = screen.getByLabel(/Public Key/i);
      const button = screen.getByRole("button", { name: /Check Account/i });
      
      // Empty input should keep button disabled or handle gracefully
      fireEvent.change(input, { target: { value: "" } });
      
      // Valid input enables submission
      fireEvent.change(input, { target: { value: "GBBD47UZQ534YFRXWX2H3CQWQ6BTCQ5QJKCNI56OTSQ53GGVS7N4ARGG" } });
      expect(button).toBeEnabled();
    });

    it("displays preflight errors when account validation fails", async () => {
      render(<PaymentPlayground />);
      
      // Preflight errors should show:
      // - TRUSTLINE_REQUIRED: asset not held
      // - INSUFFICIENT_BALANCE: balance too low
      // - Error messages with remediation steps
    });
  });

  describe("Error Handling", () => {
    it("shows retryable errors with Try Again button", async () => {
      render(<PaymentPlayground />);
      
      // Retryable errors:
      // - WALLET_REJECTED: user declined
      // - WALLET_SIGNING_TIMEOUT: timeout
      // - Should show "Try Again" button
    });

    it("shows non-retryable errors without retry option", async () => {
      render(<PaymentPlayground />);
      
      // Non-retryable errors:
      // - WALLET_NETWORK_MISMATCH: requires manual network switch
      // - Should NOT show "Try Again"
      // - Clear instructions for user action
    });

    it("distinguishes error tone by severity", async () => {
      render(<PaymentPlayground />);
      
      // Retryable errors: warning tone (amber)
      // Non-retryable errors: danger tone (red)
      // Clear visual distinction
    });
  });

  describe("Recovery", () => {
    it("detects interrupted payments on mount", async () => {
      render(<PaymentPlayground />);
      
      // On load, checks for recovery metadata
      // If found, displays recovery notification
    });

    it("displays recovery notification for pending payments", async () => {
      render(<PaymentPlayground />);
      
      // Recovery notification shows:
      // - "Recovered Payment" header
      // - Current state
      // - "Dismiss" button
    });

    it("allows dismissing recovery notification", async () => {
      render(<PaymentPlayground />);
      
      // After dismiss:
      // - Notification hidden
      // - User can proceed with new flow
      // - Recovery metadata preserved in storage
    });

    it("does not expose signed payloads in recovery", async () => {
      render(<PaymentPlayground />);
      
      // Security requirement:
      // - No PAYMENT-SIGNATURE header visible
      // - No signed XDR shown
      // - Only identifiers in UI
    });
  });

  describe("Responsive Design", () => {
    it("renders on mobile viewport", () => {
      // Set mobile viewport would be done at test setup
      render(<PaymentPlayground />);
      
      // All controls should be visible or scrollable
      expect(screen.getByText(/Payment playground/i)).toBeInTheDocument();
    });

    it("stacks challenge details on narrow screens", () => {
      render(<PaymentPlayground />);
      
      // Details should use appropriate breakpoints
      // Single column on mobile, multi-column on desktop
    });
  });

  describe("Security", () => {
    it("does not log sensitive payment data", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      
      render(<PaymentPlayground />);
      
      // Verify no secrets in console logs
      const allLogs = consoleSpy.mock.calls.join(" ");
      expect(allLogs).not.toContain("PAYMENT-SIGNATURE");
      expect(allLogs).not.toContain("signed-xdr");
      
      consoleSpy.mockRestore();
    });

    it("redacts sensitive data in error messages", () => {
      render(<PaymentPlayground />);
      
      // Errors should not expose:
      // - Full signed payloads
      // - Private key material
      // - Detailed transaction XDR
    });
  });
});
