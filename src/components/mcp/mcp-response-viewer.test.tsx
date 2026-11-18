import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  McpResponseViewer,
  McpResponsePreview,
  McpResponseContainer
} from "./mcp-response-viewer";

describe("McpResponseViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn((text) => Promise.resolve())
      }
    });
  });

  describe("rendering", () => {
    it("should render response with default title", () => {
      const response = { key: "value", nested: { num: 123 } };

      render(<McpResponseViewer response={response} />);

      expect(screen.getByText("Response")).toBeInTheDocument();
    });

    it("should render custom title and description", () => {
      const response = { key: "value" };

      render(
        <McpResponseViewer
          response={response}
          title="Custom Response"
          description="This is a test response"
        />
      );

      expect(screen.getByText("Custom Response")).toBeInTheDocument();
      expect(screen.getByText("This is a test response")).toBeInTheDocument();
    });

    it("should display response content in code block", () => {
      const response = { key: "value", number: 42 };

      render(<McpResponseViewer response={response} />);

      const codeBlock = screen.getByText(/key.*value|number.*42/);
      expect(codeBlock).toBeInTheDocument();
    });

    it("should display size information badge", () => {
      const response = { key: "value" };

      render(<McpResponseViewer response={response} />);

      const sizeText = screen.getByText(/KB|MB/);
      expect(sizeText).toBeInTheDocument();
    });

    it("should show redaction badge when redaction is enabled", () => {
      const response = { authorization: "token" };

      render(<McpResponseViewer response={response} redact={true} />);

      const redactionBadge = screen.getByText(/Redacted|Auto-redacted/);
      expect(redactionBadge).toBeInTheDocument();
    });

    it("should redact sensitive data in display", () => {
      const response = { authorization: "secret_token", public: "data" };

      render(<McpResponseViewer response={response} redact={true} />);

      const codeBlock = screen.getByText(/\[redacted\]/).textContent;
      expect(codeBlock).toContain("[redacted]");
      expect(codeBlock).toContain("data");
    });

    it("should not redact when redact is false", () => {
      const response = { authorization: "secret_token", public: "data" };

      render(<McpResponseViewer response={response} redact={false} />);

      const codeBlock = screen.getByText(/secret_token/).textContent;
      expect(codeBlock).toContain("secret_token");
    });
  });

  describe("copy to clipboard", () => {
    it("should copy response to clipboard", async () => {
      const user = userEvent.setup();
      const response = { key: "value" };
      const writeTextMock = vi.fn(() => Promise.resolve());

      Object.assign(navigator.clipboard, {
        writeText: writeTextMock
      });

      render(<McpResponseViewer response={response} />);

      const copyButton = screen.getByRole("button", { name: /Copy to clipboard/ });
      await user.click(copyButton);

      await waitFor(() => {
        expect(writeTextMock).toHaveBeenCalled();
      });
    });

    it("should show copied confirmation", async () => {
      const user = userEvent.setup();
      const response = { key: "value" };

      Object.assign(navigator.clipboard, {
        writeText: vi.fn(() => Promise.resolve())
      });

      render(<McpResponseViewer response={response} />);

      const copyButton = screen.getByRole("button", { name: /Copy to clipboard/ });
      await user.click(copyButton);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Copied!/ })).toBeInTheDocument();
      });
    });

    it("should reset copied state after 2 seconds", async () => {
      const user = userEvent.setup();
      const response = { key: "value" };
      vi.useFakeTimers();

      Object.assign(navigator.clipboard, {
        writeText: vi.fn(() => Promise.resolve())
      });

      render(<McpResponseViewer response={response} />);

      const copyButton = screen.getByRole("button", { name: /Copy to clipboard/ });
      await user.click(copyButton);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Copied!/ })).toBeInTheDocument();
      });

      vi.advanceTimersByTime(2100);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Copy to clipboard/ })).toBeInTheDocument();
      });

      vi.useRealTimers();
    });

    it("should apply redaction before copying", async () => {
      const user = userEvent.setup();
      const response = { authorization: "secret", public: "data" };
      const writeTextMock = vi.fn(() => Promise.resolve());

      Object.assign(navigator.clipboard, {
        writeText: writeTextMock
      });

      render(<McpResponseViewer response={response} redact={true} />);

      const copyButton = screen.getByRole("button", { name: /Copy to clipboard/ });
      await user.click(copyButton);

      await waitFor(() => {
        expect(writeTextMock).toHaveBeenCalled();
        const copiedText = writeTextMock.mock.calls[0][0];
        expect(copiedText).toContain("[redacted]");
      });
    });

    it("should show redaction notice when copying", async () => {
      const user = userEvent.setup();
      const response = { authorization: "secret" };

      Object.assign(navigator.clipboard, {
        writeText: vi.fn(() => Promise.resolve())
      });

      render(<McpResponseViewer response={response} redact={true} />);

      expect(
        screen.getByText("Sensitive data redacted before copy")
      ).toBeInTheDocument();
    });
  });

  describe("error handling - malformed responses", () => {
    it("should show error state for undefined response", () => {
      render(<McpResponseViewer response={undefined} />);

      expect(screen.getByText("Malformed response detected")).toBeInTheDocument();
      expect(screen.getByText(/undefined/i)).toBeInTheDocument();
    });

    it("should show error state for non-serializable response", () => {
      const circularObj: any = { key: "value" };
      circularObj.self = circularObj;

      render(<McpResponseViewer response={circularObj} />);

      expect(screen.getByText("Malformed response detected")).toBeInTheDocument();
    });

    it("should display error details", () => {
      render(<McpResponseViewer response={undefined} />);

      const errorBox = screen.getByText("Malformed response detected").closest("div");
      expect(errorBox?.textContent).toContain("Response is undefined");
    });

    it("should use alert icon for error state", () => {
      render(<McpResponseViewer response={undefined} />);

      const alertIcon = screen.getByRole("heading").querySelector("svg");
      expect(alertIcon).toBeInTheDocument();
    });
  });

  describe("large responses", () => {
    it("should show warning for huge responses", () => {
      const hugeResponse = { data: "x".repeat(2 * 1024 * 1024) };

      render(<McpResponseViewer response={hugeResponse} />);

      expect(screen.getByText("Response too large to display")).toBeInTheDocument();
    });

    it("should show size information for huge responses", () => {
      const hugeResponse = { data: "x".repeat(2 * 1024 * 1024) };

      render(<McpResponseViewer response={hugeResponse} />);

      const sizeText = screen.getByText(/Response size:/);
      expect(sizeText).toBeInTheDocument();
    });

    it("should allow copying huge responses", async () => {
      const user = userEvent.setup();
      const hugeResponse = { data: "x".repeat(2 * 1024 * 1024) };
      const writeTextMock = vi.fn(() => Promise.resolve());

      Object.assign(navigator.clipboard, {
        writeText: writeTextMock
      });

      render(<McpResponseViewer response={hugeResponse} />);

      const copyButton = screen.getByRole("button", { name: /Copy raw response/ });
      await user.click(copyButton);

      await waitFor(() => {
        expect(writeTextMock).toHaveBeenCalled();
      });
    });
  });

  describe("expandable content", () => {
    it("should show 'Show more' button for truncated content", () => {
      const largeResponse = {
        data: Array.from({ length: 100 }, (_, i) => ({ id: i }))
      };

      render(<McpResponseViewer response={largeResponse} />);

      const showMoreButton = screen.getByRole("button", { name: /Show more/ });
      expect(showMoreButton).toBeInTheDocument();
    });

    it("should expand content when clicking 'Show more'", async () => {
      const user = userEvent.setup();
      const largeResponse = {
        data: Array.from({ length: 100 }, (_, i) => ({ id: i }))
      };

      render(<McpResponseViewer response={largeResponse} />);

      const showMoreButton = screen.getByRole("button", { name: /Show more/ });
      await user.click(showMoreButton);

      expect(screen.getByRole("button", { name: /Collapse/ })).toBeInTheDocument();
    });

    it("should display full content when expanded", async () => {
      const user = userEvent.setup();
      const largeResponse = {
        data: Array.from({ length: 100 }, (_, i) => ({ id: i }))
      };

      render(<McpResponseViewer response={largeResponse} />);

      const showMoreButton = screen.getByRole("button", { name: /Show more/ });
      await user.click(showMoreButton);

      // After expansion, we should see content related to later items
      await waitFor(() => {
        const codeBlocks = screen.getAllByText(/id/);
        expect(codeBlocks.length).toBeGreaterThan(0);
      });
    });

    it("should collapse content when clicking 'Collapse'", async () => {
      const user = userEvent.setup();
      const largeResponse = {
        data: Array.from({ length: 100 }, (_, i) => ({ id: i }))
      };

      render(<McpResponseViewer response={largeResponse} />);

      let showMoreButton = screen.getByRole("button", { name: /Show more/ });
      await user.click(showMoreButton);

      const collapseButton = screen.getByRole("button", { name: /Collapse/ });
      await user.click(collapseButton);

      expect(screen.getByRole("button", { name: /Show more/ })).toBeInTheDocument();
    });
  });

  describe("badges and metadata", () => {
    it("should show line count badge for truncated content", () => {
      const largeResponse = {
        data: Array.from({ length: 100 }, (_, i) => ({ id: i }))
      };

      render(<McpResponseViewer response={largeResponse} />);

      const badge = screen.getByText(/total lines/);
      expect(badge).toBeInTheDocument();
    });

    it("should display size category in badge", () => {
      const response = { key: "value" };

      render(<McpResponseViewer response={response} />);

      const sizeText = screen.getByText(/KB/);
      expect(sizeText).toBeInTheDocument();
    });
  });

  describe("custom redaction keys", () => {
    it("should redact custom keys", () => {
      const response = { customSecret: "secret_value", public: "data" };

      render(
        <McpResponseViewer
          response={response}
          redact={true}
          additionalRedactionKeys={["customSecret"]}
        />
      );

      const codeBlock = screen.getByText(/\[redacted\]/).textContent;
      expect(codeBlock).toContain("[redacted]");
      expect(codeBlock).toContain("data");
    });

    it("should redact custom keys in copy", async () => {
      const user = userEvent.setup();
      const response = { customSecret: "secret_value", public: "data" };
      const writeTextMock = vi.fn(() => Promise.resolve());

      Object.assign(navigator.clipboard, {
        writeText: writeTextMock
      });

      render(
        <McpResponseViewer
          response={response}
          redact={true}
          additionalRedactionKeys={["customSecret"]}
        />
      );

      const copyButton = screen.getByRole("button", { name: /Copy to clipboard/ });
      await user.click(copyButton);

      await waitFor(() => {
        const copiedText = writeTextMock.mock.calls[0][0];
        expect(copiedText).toContain("[redacted]");
      });
    });
  });
});

describe("McpResponsePreview", () => {
  it("should render preview with title", () => {
    const response = { key: "value" };

    render(<McpResponsePreview response={response} title="Test Preview" />);

    expect(screen.getByText("Test Preview")).toBeInTheDocument();
  });

  it("should display truncated content", () => {
    const largeResponse = {
      data: Array.from({ length: 100 }, (_, i) => ({ id: i }))
    };

    render(<McpResponsePreview response={largeResponse} />);

    expect(screen.getByText(/View full response/)).toBeInTheDocument();
  });

  it("should call onOpenFull when clicking view full", async () => {
    const user = userEvent.setup();
    const largeResponse = {
      data: Array.from({ length: 100 }, (_, i) => ({ id: i }))
    };
    const onOpenFull = vi.fn();

    render(
      <McpResponsePreview
        response={largeResponse}
        onOpenFull={onOpenFull}
      />
    );

    const button = screen.getByRole("button", { name: /View full response/ });
    await user.click(button);

    expect(onOpenFull).toHaveBeenCalled();
  });

  it("should show line count in full response link", () => {
    const largeResponse = {
      data: Array.from({ length: 100 }, (_, i) => ({ id: i }))
    };

    render(<McpResponsePreview response={largeResponse} />);

    expect(screen.getByText(/\(\d+ lines\)/)).toBeInTheDocument();
  });
});

describe("McpResponseContainer", () => {
  it("should render children with proper spacing", () => {
    render(
      <McpResponseContainer>
        <div>Item 1</div>
        <div>Item 2</div>
      </McpResponseContainer>
    );

    expect(screen.getByText("Item 1")).toBeInTheDocument();
    expect(screen.getByText("Item 2")).toBeInTheDocument();
  });

  it("should apply custom className", () => {
    const { container } = render(
      <McpResponseContainer className="custom-class">
        <div>Content</div>
      </McpResponseContainer>
    );

    expect(container.firstChild).toHaveClass("custom-class");
  });
});

describe("accessibility", () => {
  it("should have proper heading hierarchy", () => {
    render(<McpResponseViewer response={{ key: "value" }} title="Response Title" />);

    const heading = screen.getByRole("heading");
    expect(heading).toHaveTextContent("Response Title");
  });

  it("should have proper button labels", () => {
    render(<McpResponseViewer response={{ key: "value" }} />);

    expect(screen.getByRole("button", { name: /Copy to clipboard/ })).toBeInTheDocument();
  });

  it("should indicate expanded state properly", async () => {
    const user = userEvent.setup();
    const largeResponse = {
      data: Array.from({ length: 100 }, (_, i) => ({ id: i }))
    };

    render(<McpResponseViewer response={largeResponse} />);

    const button = screen.getByRole("button", { name: /Show more/ });
    expect(button).toHaveAttribute("aria-expanded", "false");

    await user.click(button);

    expect(button).toHaveAttribute("aria-expanded", "true");
  });
});
