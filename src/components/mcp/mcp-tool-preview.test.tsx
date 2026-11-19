import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { McpToolPreview } from "./mcp-tool-preview";

describe("McpToolPreview", () => {
  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();

  const defaultProps = {
    toolName: "call_paid_resource" as const,
    arguments: {
      resourceId: "test-resource-123",
      arguments: { query: "test query" }
    },
    onConfirm: mockOnConfirm,
    onCancel: mockOnCancel
  };

  beforeEach(() => {
    mockOnConfirm.mockClear();
    mockOnCancel.mockClear();
  });

  describe("rendering", () => {
    it("renders the tool preview card with title and description", () => {
      render(<McpToolPreview {...defaultProps} />);

      expect(screen.getByText("Tool invocation preview")).toBeInTheDocument();
      expect(
        screen.getByText(/Review the tool arguments before invoking/)
      ).toBeInTheDocument();
    });

    it("renders the tool name in the info blocks", () => {
      render(<McpToolPreview {...defaultProps} />);

      expect(screen.getByText("call_paid_resource")).toBeInTheDocument();
    });

    it("renders tool description from contract", () => {
      render(<McpToolPreview {...defaultProps} />);

      expect(screen.getByText(/Call a paid resource after exact x402/)).toBeInTheDocument();
    });

    it("renders budget information", () => {
      render(<McpToolPreview {...defaultProps} />);

      expect(screen.getByText("Default limit")).toBeInTheDocument();
      expect(screen.getByText("0.5000000")).toBeInTheDocument();
      expect(screen.getByText("3 calls")).toBeInTheDocument();
    });

    it("renders deterministic errors for the tool", () => {
      render(<McpToolPreview {...defaultProps} />);

      expect(screen.getByText("PAYMENT_REQUIRED")).toBeInTheDocument();
      expect(screen.getByText("SETTLEMENT_FAILED")).toBeInTheDocument();
      expect(screen.getByText("REPLAY_DETECTED")).toBeInTheDocument();
    });

    it("renders confirm and cancel buttons", () => {
      render(<McpToolPreview {...defaultProps} />);

      expect(screen.getByRole("button", { name: /Confirm invocation/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Cancel/ })).toBeInTheDocument();
    });

    it("renders an error message when tool is not found", () => {
      render(
        <McpToolPreview
          toolName="invalid_tool" as any
          arguments={{}}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText("Tool not found")).toBeInTheDocument();
      expect(screen.getByText(/The MCP tool "invalid_tool" is not available/)).toBeInTheDocument();
    });
  });

  describe("sensitive data handling", () => {
    it("marks arguments containing sensitive keys with warning badge", () => {
      const sensitiveArgs = {
        resourceId: "test-resource",
        paymentPayload: { signature: "secret-sig" }
      };

      render(<McpToolPreview {...defaultProps} arguments={sensitiveArgs} />);

      expect(screen.getByText("Sensitive data")).toBeInTheDocument();
    });

    it("displays [redacted] for sensitive fields in arguments", () => {
      const sensitiveArgs = {
        resourceId: "test-resource",
        signature: "secret-value-should-be-hidden"
      };

      render(<McpToolPreview {...defaultProps} arguments={sensitiveArgs} />);

      expect(screen.getByText("signature")).toBeInTheDocument();
      expect(screen.getByText("[redacted]")).toBeInTheDocument();
    });

    it("displays sensitive field badges for protected keys", () => {
      const sensitiveArgs = {
        resourceId: "test-resource",
        privateKey: "secret-key",
        authorization: "bearer-token"
      };

      render(<McpToolPreview {...defaultProps} arguments={sensitiveArgs} />);

      const sensitiveElements = screen.getAllByText("sensitive");
      expect(sensitiveElements.length).toBeGreaterThan(0);
    });

    it("masks sensitive data in payment payload", () => {
      const payloadWithSensitive = {
        paymentPayload: {
          signature: "secret-sig",
          publicKey: "public-value"
        }
      };

      render(
        <McpToolPreview
          {...defaultProps}
          paymentPayload={payloadWithSensitive}
        />
      );

      expect(screen.getByText("Payment authorization")).toBeInTheDocument();
      const preContent = screen.getAllByText(/\[redacted\]/);
      expect(preContent.length).toBeGreaterThan(0);
    });

    it("displays warning badge when payment payload has sensitive data", () => {
      render(
        <McpToolPreview
          {...defaultProps}
          paymentPayload={{ signature: "secret" }}
        />
      );

      expect(screen.getByText("sensitive fields masked")).toBeInTheDocument();
    });
  });

  describe("arguments display", () => {
    it("renders all provided arguments as separate blocks", () => {
      const args = {
        resourceId: "test-123",
        maxAmount: "1.5",
        arguments: { param: "value" }
      };

      render(<McpToolPreview {...defaultProps} arguments={args} />);

      expect(screen.getByText("resourceId")).toBeInTheDocument();
      expect(screen.getByText("maxAmount")).toBeInTheDocument();
      expect(screen.getByText("arguments")).toBeInTheDocument();
    });

    it("marks required fields with required badge", () => {
      const args = {
        resourceId: "test-123",
        arguments: { param: "value" },
        paymentPayload: {}
      };

      render(<McpToolPreview {...defaultProps} arguments={args} />);

      const requiredBadges = screen.getAllByText("required");
      expect(requiredBadges.length).toBeGreaterThanOrEqual(3); // resourceId, arguments, paymentPayload are required
    });

    it("displays JSON representation of argument values", () => {
      const args = {
        resourceId: "test-123",
        maxAmount: "0.5",
        arguments: { nested: { value: 42 } }
      };

      render(<McpToolPreview {...defaultProps} arguments={args} />);

      // Check that JSON stringified values appear
      expect(screen.getByText('"test-123"')).toBeInTheDocument();
      expect(screen.getByText('"0.5"')).toBeInTheDocument();
    });

    it("shows empty state when no arguments provided", () => {
      render(<McpToolPreview {...defaultProps} arguments={{}} />);

      expect(screen.getByText("No arguments provided.")).toBeInTheDocument();
    });
  });

  describe("payment payload display", () => {
    it("renders payment payload section when provided", () => {
      const payload = {
        paymentRequirements: {
          amount: "0.5",
          asset: "native"
        }
      };

      render(<McpToolPreview {...defaultProps} paymentPayload={payload} />);

      expect(screen.getByText("Payment authorization")).toBeInTheDocument();
    });

    it("does not render payment payload section when not provided", () => {
      render(<McpToolPreview {...defaultProps} />);

      expect(screen.queryByText("Payment authorization")).not.toBeInTheDocument();
    });

    it("displays redacted payment payload in code block", () => {
      const payload = {
        signature: "secret-sig",
        amount: "0.5"
      };

      render(<McpToolPreview {...defaultProps} paymentPayload={payload} />);

      const preElements = screen.getAllByRole("img", { hidden: true });
      expect(preElements.length).toBeGreaterThan(0);
    });
  });

  describe("budget controls display", () => {
    it("displays default max amount from tool contract", () => {
      render(<McpToolPreview {...defaultProps} />);

      expect(screen.getByText("Default limit")).toBeInTheDocument();
      expect(screen.getByText("0.5000000")).toBeInTheDocument();
    });

    it("displays override limit when maxAmount prop provided", () => {
      render(<McpToolPreview {...defaultProps} maxAmount="2.0000000" />);

      expect(screen.getByText("Override limit")).toBeInTheDocument();
      expect(screen.getByText("2.0000000")).toBeInTheDocument();
    });
  });

  describe("user interactions", () => {
    it("calls onConfirm when confirm button is clicked", () => {
      render(<McpToolPreview {...defaultProps} />);

      const confirmButton = screen.getByRole("button", { name: /Confirm invocation/ });
      fireEvent.click(confirmButton);

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });

    it("calls onCancel when cancel button is clicked", () => {
      render(<McpToolPreview {...defaultProps} />);

      const cancelButton = screen.getByRole("button", { name: /Cancel/ });
      fireEvent.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it("disables buttons when isLoading is true", () => {
      render(<McpToolPreview {...defaultProps} isLoading={true} />);

      const confirmButton = screen.getByRole("button", { name: /Invoking/ });
      const cancelButton = screen.getByRole("button", { name: /Cancel/ });

      expect(confirmButton).toBeDisabled();
      expect(cancelButton).toBeDisabled();
    });

    it("shows loading text on confirm button when isLoading is true", () => {
      render(<McpToolPreview {...defaultProps} isLoading={true} />);

      expect(screen.getByRole("button", { name: /Invoking/ })).toBeInTheDocument();
    });
  });

  describe("different tool types", () => {
    it("renders search_paid_resources tool correctly", () => {
      render(
        <McpToolPreview
          toolName="search_paid_resources"
          arguments={{ q: "test query" }}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText("search_paid_resources")).toBeInTheDocument();
      expect(screen.getByText(/Search indexed paid HTTP APIs/)).toBeInTheDocument();
    });

    it("renders inspect_resource tool correctly", () => {
      render(
        <McpToolPreview
          toolName="inspect_resource"
          arguments={{ resourceId: "test-resource" }}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText("inspect_resource")).toBeInTheDocument();
      expect(screen.getByText(/Inspect a paid resource/)).toBeInTheDocument();
    });

    it("displays correct budget info for each tool", () => {
      const { rerender } = render(
        <McpToolPreview
          toolName="search_paid_resources"
          arguments={{ q: "test" }}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText("1.0000000")).toBeInTheDocument();

      rerender(
        <McpToolPreview
          toolName="inspect_resource"
          arguments={{ resourceId: "test" }}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText("0.0000000")).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("has proper heading hierarchy", () => {
      render(<McpToolPreview {...defaultProps} />);

      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading).toHaveTextContent("Tool invocation preview");
    });

    it("renders icons with aria-hidden for decorative elements", () => {
      const { container } = render(<McpToolPreview {...defaultProps} />);

      const icons = container.querySelectorAll("[aria-hidden='true']");
      expect(icons.length).toBeGreaterThan(0);
    });
  });
});
