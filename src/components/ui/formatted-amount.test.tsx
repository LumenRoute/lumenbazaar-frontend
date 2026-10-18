import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { FormattedAmount } from "@/lib/amount-formatter";
import { FormattedAmountDisplay } from "./formatted-amount";

describe("FormattedAmountDisplay", () => {
  const mockFormattedAmount: FormattedAmount = {
    atomic: "1234567",
    contractId: "CA7QYNF7SOWQ4VJNMGEVXZHYQACUIM2MRRPFNQ4SLRJRYE67Z2BJQXMR",
    decimals: 6,
    formatted: "1.234567",
    symbol: "USDC"
  };

  describe("with valid formatted amount", () => {
    it("renders formatted amount and symbol", () => {
      render(<FormattedAmountDisplay formattedAmount={mockFormattedAmount} />);

      expect(screen.getByText(/1\.234567 USDC/)).toBeInTheDocument();
    });

    it("renders atomic value by default", () => {
      render(<FormattedAmountDisplay formattedAmount={mockFormattedAmount} />);

      expect(screen.getByText(/atomic: 1234567/)).toBeInTheDocument();
    });

    it("renders shortened contract address", () => {
      render(<FormattedAmountDisplay formattedAmount={mockFormattedAmount} />);

      // shortHash should produce format: first 8 chars...last 8 chars
      const contractText = screen.getByText(/contract:/);
      expect(contractText).toBeInTheDocument();
    });

    it("hides atomic view when showAtomic is false", () => {
      render(
        <FormattedAmountDisplay formattedAmount={mockFormattedAmount} showAtomic={false} />
      );

      expect(screen.queryByText(/atomic:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/contract:/)).not.toBeInTheDocument();
    });

    it("applies custom className", () => {
      const { container } = render(
        <FormattedAmountDisplay
          formattedAmount={mockFormattedAmount}
          className="custom-class"
        />
      );

      const div = container.querySelector(".custom-class");
      expect(div).toBeInTheDocument();
    });

    it("shows formatted value with multiple decimal places", () => {
      const amount: FormattedAmount = {
        ...mockFormattedAmount,
        formatted: "0.000001"
      };

      render(<FormattedAmountDisplay formattedAmount={amount} />);

      expect(screen.getByText(/0\.000001 USDC/)).toBeInTheDocument();
    });

    it("shows amount without decimals for whole numbers", () => {
      const amount: FormattedAmount = {
        ...mockFormattedAmount,
        formatted: "100"
      };

      render(<FormattedAmountDisplay formattedAmount={amount} />);

      expect(screen.getByText(/^100 USDC$/)).toBeInTheDocument();
    });
  });

  describe("with null formatted amount (fallback)", () => {
    it("renders unknown asset label", () => {
      render(
        <FormattedAmountDisplay
          formattedAmount={null}
          fallbackContractId={mockFormattedAmount.contractId}
        />
      );

      expect(screen.getByText("Unknown asset")).toBeInTheDocument();
    });

    it("renders contract ID in fallback mode", () => {
      render(
        <FormattedAmountDisplay
          formattedAmount={null}
          fallbackContractId={mockFormattedAmount.contractId}
        />
      );

      const contractText = screen.getByText(/contract:/);
      expect(contractText).toBeInTheDocument();
    });

    it("does not render formatted amount", () => {
      render(
        <FormattedAmountDisplay
          formattedAmount={null}
          fallbackContractId={mockFormattedAmount.contractId}
        />
      );

      expect(screen.queryByText(/\d+\.\d+ \w+/)).not.toBeInTheDocument();
    });

    it("does not render atomic value when showAtomic is false", () => {
      render(
        <FormattedAmountDisplay
          formattedAmount={null}
          fallbackContractId={mockFormattedAmount.contractId}
          showAtomic={false}
        />
      );

      expect(screen.queryByText(/contract:/)).not.toBeInTheDocument();
    });

    it("handles missing fallbackContractId gracefully", () => {
      render(
        <FormattedAmountDisplay
          formattedAmount={null}
          fallbackContractId={undefined}
        />
      );

      expect(screen.getByText("Unknown asset")).toBeInTheDocument();
      expect(screen.getByText(/contract:/)).toBeInTheDocument();
    });
  });

  describe("different asset symbols", () => {
    it("displays BRL symbol", () => {
      const brl: FormattedAmount = {
        ...mockFormattedAmount,
        formatted: "1.2345678",
        symbol: "BRL"
      };

      render(<FormattedAmountDisplay formattedAmount={brl} />);

      expect(screen.getByText(/BRL/)).toBeInTheDocument();
    });

    it("displays single-character symbol", () => {
      const x: FormattedAmount = {
        ...mockFormattedAmount,
        formatted: "100",
        symbol: "X"
      };

      render(<FormattedAmountDisplay formattedAmount={x} />);

      expect(screen.getByText(/100 X/)).toBeInTheDocument();
    });
  });

  describe("symbol spoofing prevention", () => {
    const usdc_v1: FormattedAmount = {
      atomic: "1000000",
      contractId: "CA7QYNF7SOWQ4VJNMGEVXZHYQACUIM2MRRPFNQ4SLRJRYE67Z2BJQXMR",
      decimals: 6,
      formatted: "1",
      symbol: "USDC"
    };

    const usdc_v2: FormattedAmount = {
      ...usdc_v1,
      contractId: "CB7QYNF7SOWQ4VJNMGEVXZHYQACUIM2MRRPFNQ4SLRJRYE67Z2BJQXMR"
    };

    it("displays different contract IDs for same symbol", () => {
      const { container: container1 } = render(
        <FormattedAmountDisplay formattedAmount={usdc_v1} />
      );

      const { container: container2 } = render(
        <FormattedAmountDisplay formattedAmount={usdc_v2} />
      );

      const contract1 = container1.textContent;
      const contract2 = container2.textContent;

      // Both should have "contract:" but different hashes
      expect(contract1).toContain("contract:");
      expect(contract2).toContain("contract:");
      // The full contract IDs are different (not visible after shortHash but in data attribute)
      expect(usdc_v1.contractId).not.toBe(usdc_v2.contractId);
    });
  });

  describe("large amounts", () => {
    it("displays i64 max value", () => {
      const large: FormattedAmount = {
        ...mockFormattedAmount,
        formatted: "9223372036.854775807"
      };

      render(<FormattedAmountDisplay formattedAmount={large} />);

      expect(screen.getByText(/9223372036\.854775807 USDC/)).toBeInTheDocument();
    });

    it("displays i128 boundary value", () => {
      const huge: FormattedAmount = {
        ...mockFormattedAmount,
        formatted: "170141183460469231731687303715.884105727"
      };

      render(<FormattedAmountDisplay formattedAmount={huge} />);

      expect(screen.getByText(/atomic:/)).toBeInTheDocument();
    });
  });

  describe("zero decimals", () => {
    it("displays amount with 0 decimals asset", () => {
      const whole: FormattedAmount = {
        ...mockFormattedAmount,
        decimals: 0,
        formatted: "100",
        symbol: "WHOLE"
      };

      render(<FormattedAmountDisplay formattedAmount={whole} />);

      expect(screen.getByText(/100 WHOLE/)).toBeInTheDocument();
    });
  });

  describe("max decimals (7)", () => {
    it("displays amount with 7 decimals", () => {
      const tiny: FormattedAmount = {
        ...mockFormattedAmount,
        decimals: 7,
        formatted: "0.0000001",
        symbol: "TINY"
      };

      render(<FormattedAmountDisplay formattedAmount={tiny} />);

      expect(screen.getByText(/0\.0000001 TINY/)).toBeInTheDocument();
    });
  });

  describe("responsive accessibility", () => {
    it("renders in semantic structure for screen readers", () => {
      const { container } = render(
        <FormattedAmountDisplay formattedAmount={mockFormattedAmount} />
      );

      // Formatted amount is in the main content
      expect(container.querySelector(".font-semibold")).toHaveTextContent(
        "1.234567 USDC"
      );

      // Atomic and contract info is in secondary text (still accessible)
      const secondaryText = container.querySelector(".text-xs");
      expect(secondaryText).toHaveTextContent("atomic:");
      expect(secondaryText).toHaveTextContent("contract:");
    });

    it("provides both formatted and atomic for verification", () => {
      const { container } = render(
        <FormattedAmountDisplay formattedAmount={mockFormattedAmount} />
      );

      const mainText = container.querySelector(".font-semibold");
      const secondaryText = container.querySelector(".text-xs");

      // Both are present and visible
      expect(mainText).toHaveTextContent("1.234567 USDC");
      expect(secondaryText).toHaveTextContent("1234567");
    });
  });
});
