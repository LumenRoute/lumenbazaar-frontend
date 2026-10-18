import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaymentRequirementViewer } from "./payment-requirement-viewer";
import type { ResourcePaymentSummary } from "@/services/api/schemas";

describe("PaymentRequirementViewer", () => {
  const baseRequirement: ResourcePaymentSummary = {
    amount: "500000",
    assetCode: "USDC",
    assetIssuer: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    extensions: {},
    network: "stellar:testnet",
    payTo: "GBRPYHIL2CI3WHZSKMHPPGYJRF7V4SGQLWJMNDT3XONU2CI6X3BLKVOY",
    resourceId: "resource_123"
  };

  describe("trusted asset", () => {
    it("displays trusted asset with success badge", () => {
      const requirement: ResourcePaymentSummary = {
        ...baseRequirement,
        extensions: {
          assetContractId: "CBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE"
        }
      };

      render(<PaymentRequirementViewer requirement={requirement} />);

      expect(screen.getByText("Trusted Asset")).toBeInTheDocument();
      expect(screen.getByText(/Trusted asset \(USDC\)/)).toBeInTheDocument();
    });

    it("shows contract address comparison for trusted asset", () => {
      const requirement: ResourcePaymentSummary = {
        ...baseRequirement,
        extensions: {
          assetContractId: "CBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE"
        }
      };

      render(<PaymentRequirementViewer requirement={requirement} />);

      expect(
        screen.getByText("CBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE")
      ).toBeInTheDocument();
      expect(screen.getByText("Contract addresses match")).toBeInTheDocument();
    });
  });

  describe("unknown asset warning", () => {
    it("displays warning when asset is unknown", () => {
      const requirement: ResourcePaymentSummary = {
        ...baseRequirement,
        extensions: {
          assetContractId: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"
        }
      };

      render(<PaymentRequirementViewer requirement={requirement} />);

      expect(screen.getByText("Unknown Asset")).toBeInTheDocument();
      expect(
        screen.getByText(/not in the trusted registry/)
      ).toBeInTheDocument();
    });

    it("shows unknown asset contract address without registry entry", () => {
      const requirement: ResourcePaymentSummary = {
        ...baseRequirement,
        extensions: {
          assetContractId: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"
        }
      };

      render(<PaymentRequirementViewer requirement={requirement} />);

      expect(
        screen.getByText("CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC")
      ).toBeInTheDocument();
      expect(
        screen.getByText(/not in the trusted registry for this network/)
      ).toBeInTheDocument();
    });

    it("hides normal payment viewer when asset is unknown", () => {
      const requirement: ResourcePaymentSummary = {
        ...baseRequirement,
        extensions: {
          assetContractId: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"
        }
      };

      render(<PaymentRequirementViewer requirement={requirement} />);

      // Unknown asset mode blocks normal viewer
      expect(screen.queryByText("Catalog payment summary")).not.toBeInTheDocument();
    });
  });

  describe("confirmation checkbox", () => {
    it("renders confirmation checkbox for unknown asset", () => {
      const requirement: ResourcePaymentSummary = {
        ...baseRequirement,
        extensions: {
          assetContractId: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"
        }
      };

      render(<PaymentRequirementViewer requirement={requirement} />);

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).not.toBeChecked();
    });

    it("checkbox is not pre-checked", () => {
      const requirement: ResourcePaymentSummary = {
        ...baseRequirement,
        extensions: {
          assetContractId: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"
        }
      };

      render(<PaymentRequirementViewer requirement={requirement} />);

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).not.toBeChecked();
    });

    it("displays helpful text with checkbox", () => {
      const requirement: ResourcePaymentSummary = {
        ...baseRequirement,
        extensions: {
          assetContractId: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"
        }
      };

      render(<PaymentRequirementViewer requirement={requirement} />);

      expect(
        screen.getByText(/I understand this asset is not in the trusted registry/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/I have verified the contract address and proceed at my own risk/)
      ).toBeInTheDocument();
    });
  });

  describe("proceed button", () => {
    it("disables proceed button when checkbox is unchecked", () => {
      const requirement: ResourcePaymentSummary = {
        ...baseRequirement,
        extensions: {
          assetContractId: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"
        }
      };

      render(<PaymentRequirementViewer requirement={requirement} />);

      const button = screen.getByRole("button", {
        name: /Proceed with Unknown Asset/
      });
      expect(button).toBeDisabled();
    });

    it("enables proceed button when checkbox is checked", async () => {
      const user = userEvent.setup();
      const requirement: ResourcePaymentSummary = {
        ...baseRequirement,
        extensions: {
          assetContractId: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"
        }
      };

      render(<PaymentRequirementViewer requirement={requirement} />);

      const checkbox = screen.getByRole("checkbox");
      await user.click(checkbox);

      const button = screen.getByRole("button", {
        name: /Proceed with Unknown Asset/
      });
      expect(button).not.toBeDisabled();
    });

    it("calls onConfirmUnknownAsset callback when proceed is clicked", async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      const requirement: ResourcePaymentSummary = {
        ...baseRequirement,
        extensions: {
          assetContractId: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"
        }
      };

      render(
        <PaymentRequirementViewer
          requirement={requirement}
          onConfirmUnknownAsset={onConfirm}
        />
      );

      const checkbox = screen.getByRole("checkbox");
      await user.click(checkbox);

      const button = screen.getByRole("button", {
        name: /Proceed with Unknown Asset/
      });
      await user.click(button);

      expect(onConfirm).toHaveBeenCalled();
    });
  });

  describe("malformed asset", () => {
    it("displays error when asset contract ID is malformed", () => {
      const requirement: ResourcePaymentSummary = {
        ...baseRequirement,
        extensions: {
          assetContractId: "INVALID_CONTRACT_ID"
        }
      };

      render(<PaymentRequirementViewer requirement={requirement} />);

      expect(screen.getByText("Invalid Asset Contract")).toBeInTheDocument();
      expect(
        screen.getByText(/invalid contract ID and cannot be processed/)
      ).toBeInTheDocument();
    });

    it("does not show confirmation checkbox for malformed asset", () => {
      const requirement: ResourcePaymentSummary = {
        ...baseRequirement,
        extensions: {
          assetContractId: "INVALID_CONTRACT_ID"
        }
      };

      render(<PaymentRequirementViewer requirement={requirement} />);

      expect(
        screen.queryByRole("checkbox")
      ).not.toBeInTheDocument();
    });

    it("shows correction message for malformed asset", () => {
      const requirement: ResourcePaymentSummary = {
        ...baseRequirement,
        extensions: {
          assetContractId: "INVALID_CONTRACT_ID"
        }
      };

      render(<PaymentRequirementViewer requirement={requirement} />);

      expect(
        screen.getByText(/Please correct the contract ID and try again/)
      ).toBeInTheDocument();
    });
  });

  describe("lookalike detection", () => {
    it("classifies lookalike symbol asset as unknown", () => {
      const requirement: ResourcePaymentSummary = {
        ...baseRequirement,
        extensions: {
          // Valid contract format, but not in registry (lookalike USDC)
          assetContractId: "CBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQ1"
        }
      };

      render(<PaymentRequirementViewer requirement={requirement} />);

      expect(screen.getByText("Unknown Asset")).toBeInTheDocument();
      // Should NOT show "Trusted Asset"
      expect(screen.queryByText("Trusted Asset")).not.toBeInTheDocument();
    });
  });

  describe("no asset contract ID", () => {
    it("renders normal viewer when no asset contract ID provided", () => {
      const requirement: ResourcePaymentSummary = {
        ...baseRequirement,
        extensions: {}
      };

      render(<PaymentRequirementViewer requirement={requirement} />);

      expect(screen.getByText("Catalog payment summary")).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("focuses warning heading when unknown asset appears", async () => {
      const requirement: ResourcePaymentSummary = {
        ...baseRequirement,
        extensions: {
          assetContractId: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"
        }
      };

      render(<PaymentRequirementViewer requirement={requirement} />);

      const heading = screen.getByText("Unknown Asset");
      await waitFor(() => {
        expect(heading).toHaveFocus();
      });
    });

    it("checkbox has associated label", () => {
      const requirement: ResourcePaymentSummary = {
        ...baseRequirement,
        extensions: {
          assetContractId: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"
        }
      };

      render(<PaymentRequirementViewer requirement={requirement} />);

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toHaveAttribute("id", "confirm-unknown-asset");
      expect(checkbox).toHaveAttribute("aria-describedby", "confirm-unknown-asset-description");
    });

    it("uses semantic heading for warning", () => {
      const requirement: ResourcePaymentSummary = {
        ...baseRequirement,
        extensions: {
          assetContractId: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"
        }
      };

      const { container } = render(
        <PaymentRequirementViewer requirement={requirement} />
      );

      const h3 = container.querySelector("h3");
      expect(h3).toBeInTheDocument();
      expect(h3?.textContent).toContain("Unknown Asset");
    });
  });
});
