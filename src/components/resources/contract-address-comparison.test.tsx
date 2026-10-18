import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContractAddressComparison } from "./contract-address-comparison";
import type { AssetMetadata } from "@/config/networks";

describe("ContractAddressComparison", () => {
  const testContractId = "CBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE";

  const testRegistryEntry: AssetMetadata = {
    contractId: testContractId,
    symbol: "USDC",
    decimals: 6,
    issuer: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
  };

  describe("rendering", () => {
    it("renders requirement contract address", () => {
      render(
        <ContractAddressComparison contractId={testContractId} />
      );

      expect(screen.getByText("Payment Requirement")).toBeInTheDocument();
      expect(screen.getByText(testContractId)).toBeInTheDocument();
    });

    it("displays registry entry when provided", () => {
      render(
        <ContractAddressComparison
          contractId={testContractId}
          registryEntry={testRegistryEntry}
        />
      );

      expect(screen.getByText("Trusted Registry Entry")).toBeInTheDocument();
      expect(screen.getByText("USDC")).toBeInTheDocument();
      expect(screen.getByText("decimals: 6")).toBeInTheDocument();
    });

    it("displays issuer abbreviation when present", () => {
      render(
        <ContractAddressComparison
          contractId={testContractId}
          registryEntry={testRegistryEntry}
        />
      );

      expect(screen.getByText(/issuer: GAAA/)).toBeInTheDocument();
    });

    it("does not display issuer when not present", () => {
      const entryWithoutIssuer: AssetMetadata = {
        contractId: testContractId,
        symbol: "BRL",
        decimals: 7
      };

      render(
        <ContractAddressComparison
          contractId={testContractId}
          registryEntry={entryWithoutIssuer}
        />
      );

      expect(screen.queryByText(/issuer:/)).not.toBeInTheDocument();
    });

    it("shows 'not in trusted registry' message when no entry provided", () => {
      render(
        <ContractAddressComparison contractId={testContractId} />
      );

      expect(
        screen.getByText(/not in the trusted registry/)
      ).toBeInTheDocument();
    });
  });

  describe("match/mismatch detection", () => {
    it("shows match indicator when addresses match", () => {
      render(
        <ContractAddressComparison
          contractId={testContractId}
          registryEntry={testRegistryEntry}
        />
      );

      expect(screen.getByText(/Contract addresses match/)).toBeInTheDocument();
      expect(screen.queryByText(/do not match/)).not.toBeInTheDocument();
    });

    it("shows mismatch indicator when addresses differ (lookalike)", () => {
      const lookalike = "CBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQ1";
      const entryWithDifferentAddress: AssetMetadata = {
        ...testRegistryEntry,
        contractId: testContractId
      };

      render(
        <ContractAddressComparison
          contractId={lookalike}
          registryEntry={entryWithDifferentAddress}
        />
      );

      expect(screen.getByText(/do not match/)).toBeInTheDocument();
      expect(
        screen.getByText(/potential lookalike: same symbol, different contract/)
      ).toBeInTheDocument();
    });
  });

  describe("copy to clipboard", () => {
    it("copies contract address on button click", async () => {
      const user = userEvent.setup();
      const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText: clipboardWriteText } });

      render(
        <ContractAddressComparison contractId={testContractId} />
      );

      const copyButton = screen.getByLabelText("Copy contract address");
      await user.click(copyButton);

      expect(clipboardWriteText).toHaveBeenCalledWith(testContractId);
    });

    it("shows copy feedback after successful copy", async () => {
      const user = userEvent.setup();
      Object.assign(navigator, {
        clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }
      });

      render(
        <ContractAddressComparison contractId={testContractId} />
      );

      const copyButton = screen.getByLabelText("Copy contract address");
      await user.click(copyButton);

      // Check that button title changes to indicate success
      expect(copyButton).toHaveAttribute("title", "Copied!");

      // Feedback should disappear after 2 seconds
      await waitFor(
        () => {
          expect(copyButton).toHaveAttribute("title", "Copy to clipboard");
        },
        { timeout: 3000 }
      );
    });

    it("has accessible copy button with aria-label", () => {
      render(
        <ContractAddressComparison contractId={testContractId} />
      );

      const copyButton = screen.getByLabelText("Copy contract address");
      expect(copyButton).toBeInTheDocument();
      expect(copyButton).toHaveAttribute("type", "button");
    });

    it("copy button is keyboard accessible", async () => {
      const user = userEvent.setup();
      const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText: clipboardWriteText } });

      render(
        <ContractAddressComparison contractId={testContractId} />
      );

      const copyButton = screen.getByLabelText("Copy contract address");
      copyButton.focus();
      expect(copyButton).toHaveFocus();

      await user.keyboard("{Enter}");
      expect(clipboardWriteText).toHaveBeenCalledWith(testContractId);
    });
  });

  describe("accessibility", () => {
    it("uses semantic structure with <dt> and <dd>", () => {
      const { container } = render(
        <ContractAddressComparison contractId={testContractId} />
      );

      const dts = container.querySelectorAll("dt");
      const dds = container.querySelectorAll("dd");

      expect(dts.length).toBeGreaterThan(0);
      expect(dds.length).toBeGreaterThan(0);
    });

    it("displays contract address in monospace font", () => {
      const { container } = render(
        <ContractAddressComparison contractId={testContractId} />
      );

      const codeElement = container.querySelector("code");
      expect(codeElement).toBeInTheDocument();
      expect(codeElement).toHaveClass("font-mono");
    });

    it("uses icons with aria-hidden when text is present", () => {
      const { container } = render(
        <ContractAddressComparison
          contractId={testContractId}
          registryEntry={testRegistryEntry}
        />
      );

      const icons = container.querySelectorAll('[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe("responsive design", () => {
    it("uses break-all class for address wrapping on mobile", () => {
      const { container } = render(
        <ContractAddressComparison contractId={testContractId} />
      );

      const addressElement = container.querySelector("code");
      expect(addressElement).toHaveClass("break-all");
    });

    it("renders without horizontal overflow", () => {
      const { container } = render(
        <ContractAddressComparison contractId={testContractId} />
      );

      // Just verify it renders; actual overflow is tested via E2E
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe("edge cases", () => {
    it("handles very long contract IDs gracefully", () => {
      const longId = "C" + "A".repeat(55);
      render(<ContractAddressComparison contractId={longId} />);

      expect(screen.getByText(longId)).toBeInTheDocument();
    });

    it("handles registry entry without optional fields", () => {
      const minimalEntry: AssetMetadata = {
        contractId: testContractId,
        symbol: "TEST",
        decimals: 0
      };

      render(
        <ContractAddressComparison
          contractId={testContractId}
          registryEntry={minimalEntry}
        />
      );

      expect(screen.getByText("TEST")).toBeInTheDocument();
      expect(screen.getByText("decimals: 0")).toBeInTheDocument();
    });

    it("handles clipboard API failure gracefully", async () => {
      const user = userEvent.setup();
      const clipboardWriteText = vi.fn().mockRejectedValue(new Error("Access denied"));
      Object.assign(navigator, { clipboard: { writeText: clipboardWriteText } });

      render(
        <ContractAddressComparison contractId={testContractId} />
      );

      const copyButton = screen.getByLabelText("Copy contract address");
      await user.click(copyButton);

      // Should not crash; button should remain in default state
      expect(copyButton).toHaveAttribute("title", "Copy to clipboard");
    });
  });
});
