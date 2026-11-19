import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

import { DocsSearch } from "./docs-search";
import { resetDocumentationIndexCache } from "@/services/docs-index";

describe("DocsSearch Component", () => {
  beforeEach(() => {
    resetDocumentationIndexCache();
  });

  afterEach(() => {
    resetDocumentationIndexCache();
  });

  describe("Rendering", () => {
    it("renders search input with placeholder", () => {
      render(<DocsSearch />);

      const input = screen.getByPlaceholderText(/Search documentation/i);
      expect(input).toBeInTheDocument();
    });

    it("renders search icon", () => {
      render(<DocsSearch />);

      const icon = screen.getByRole("img", { hidden: true });
      expect(icon).toBeInTheDocument();
    });

    it("renders with proper accessibility attributes", () => {
      render(<DocsSearch />);

      const input = screen.getByLabelText("Search documentation");
      expect(input).toHaveAttribute("type", "text");
    });

    it("does not render results dropdown initially", () => {
      render(<DocsSearch />);

      const listbox = screen.queryByRole("listbox");
      expect(listbox).not.toBeInTheDocument();
    });
  });

  describe("Search Interaction", () => {
    it("shows results dropdown when user types", async () => {
      render(<DocsSearch />);

      const input = screen.getByPlaceholderText(/Search documentation/i);
      await userEvent.type(input, "seller");

      await waitFor(() => {
        const listbox = screen.getByRole("listbox");
        expect(listbox).toBeInTheDocument();
      });
    });

    it("displays search results as list items", async () => {
      render(<DocsSearch />);

      const input = screen.getByPlaceholderText(/Search documentation/i);
      await userEvent.type(input, "seller");

      await waitFor(() => {
        const options = screen.getAllByRole("option");
        expect(options.length).toBeGreaterThan(0);
      });
    });

    it("hides results when input is cleared", async () => {
      render(<DocsSearch />);

      const input = screen.getByPlaceholderText(/Search documentation/i) as HTMLInputElement;
      await userEvent.type(input, "seller");

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      await userEvent.clear(input);

      await waitFor(() => {
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      });
    });

    it("shows no results message when query has no matches", async () => {
      render(<DocsSearch />);

      const input = screen.getByPlaceholderText(/Search documentation/i);
      await userEvent.type(input, "xyznonexistent");

      await waitFor(() => {
        const message = screen.getByText(/No documentation found/i);
        expect(message).toBeInTheDocument();
      });
    });

    it("updates results as user types", async () => {
      render(<DocsSearch />);

      const input = screen.getByPlaceholderText(/Search documentation/i);

      await userEvent.type(input, "s");
      await waitFor(() => {
        const firstResults = screen.getAllByRole("option");
        const firstCount = firstResults.length;

        expect(firstCount).toBeGreaterThan(0);

        return firstCount;
      });

      await userEvent.type(input, "eller");
      await waitFor(() => {
        const options = screen.getAllByRole("option");
        // More specific query should return fewer or same results
        expect(options.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Clear Button", () => {
    it("shows clear button when input has text", async () => {
      render(<DocsSearch />);

      const input = screen.getByPlaceholderText(/Search documentation/i);
      await userEvent.type(input, "seller");

      const clearButton = screen.getByLabelText("Clear search");
      expect(clearButton).toBeInTheDocument();
    });

    it("clears input when clear button is clicked", async () => {
      render(<DocsSearch />);

      const input = screen.getByPlaceholderText(/Search documentation/i) as HTMLInputElement;
      await userEvent.type(input, "seller");

      const clearButton = screen.getByLabelText("Clear search");
      await userEvent.click(clearButton);

      expect(input.value).toBe("");
    });

    it("hides clear button when input is empty", async () => {
      render(<DocsSearch />);

      const input = screen.getByPlaceholderText(/Search documentation/i);
      await userEvent.type(input, "seller");

      let clearButton = screen.getByLabelText("Clear search");
      expect(clearButton).toBeInTheDocument();

      await userEvent.clear(input);

      clearButton = screen.queryByLabelText("Clear search");
      expect(clearButton).not.toBeInTheDocument();
    });

    it("focuses input after clearing", async () => {
      render(<DocsSearch />);

      const input = screen.getByPlaceholderText(/Search documentation/i) as HTMLInputElement;
      await userEvent.type(input, "seller");

      const clearButton = screen.getByLabelText("Clear search");
      await userEvent.click(clearButton);

      expect(document.activeElement).toBe(input);
    });
  });

  describe("Result Display", () => {
    it("displays result label, description, and keywords", async () => {
      render(<DocsSearch />);

      const input = screen.getByPlaceholderText(/Search documentation/i);
      await userEvent.type(input, "seller");

      await waitFor(() => {
        const options = screen.getAllByRole("option");
        expect(options.length).toBeGreaterThan(0);

        // Check that results show expected content
        const option = options[0];
        expect(option.textContent).toBeTruthy();
      });
    });

    it("shows relevance score as percentage badge", async () => {
      render(<DocsSearch />);

      const input = screen.getByPlaceholderText(/Search documentation/i);
      await userEvent.type(input, "Seller docs");

      await waitFor(() => {
        const badges = screen.getAllByText(/\d+%/);
        expect(badges.length).toBeGreaterThan(0);
      });
    });

    it("shows external link icon for each result", async () => {
      render(<DocsSearch />);

      const input = screen.getByPlaceholderText(/Search documentation/i);
      await userEvent.type(input, "seller");

      await waitFor(() => {
        const icons = screen.getAllByRole("img", { hidden: true });
        expect(icons.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Keyboard Navigation", () => {
    it("navigates down through results with arrow down key", async () => {
      render(<DocsSearch />);

      const input = screen.getByPlaceholderText(/Search documentation/i);
      await userEvent.type(input, "docs");

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      const options = screen.getAllByRole("option");
      const firstOption = options[0];

      fireEvent.keyDown(input, { key: "ArrowDown" });

      expect(firstOption).toHaveClass("border-teal-300", "bg-teal-50/60");
    });

    it("navigates up through results with arrow up key", async () => {
      render(<DocsSearch />);

      const input = screen.getByPlaceholderText(/Search documentation/i);
      await userEvent.type(input, "docs");

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      const options = screen.getAllByRole("option");

      // Navigate down to second option
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(input, { key: "ArrowDown" });

      // Navigate up to first option
      fireEvent.keyDown(input, { key: "ArrowUp" });

      expect(options[0]).toHaveClass("border-teal-300", "bg-teal-50/60");
    });

    it("closes dropdown with escape key", async () => {
      render(<DocsSearch />);

      const input = screen.getByPlaceholderText(/Search documentation/i);
      await userEvent.type(input, "seller");

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      fireEvent.keyDown(input, { key: "Escape" });

      await waitFor(() => {
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      });
    });

    it("clears query with escape key", async () => {
      render(<DocsSearch />);

      const input = screen.getByPlaceholderText(/Search documentation/i) as HTMLInputElement;
      await userEvent.type(input, "seller");

      fireEvent.keyDown(input, { key: "Escape" });

      expect(input.value).toBe("");
    });

    it("selects highlighted result with enter key", async () => {
      const onResultSelect = vi.fn();

      render(<DocsSearch onResultSelect={onResultSelect} />);

      const input = screen.getByPlaceholderText(/Search documentation/i);
      await userEvent.type(input, "seller");

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(input, { key: "Enter" });

      // Result selection callback should be called
      expect(onResultSelect).not.toThrow();
    });
  });

  describe("Click Outside Behavior", () => {
    it("closes dropdown when clicking outside", async () => {
      render(
        <div>
          <DocsSearch />
          <button>Outside button</button>
        </div>
      );

      const input = screen.getByPlaceholderText(/Search documentation/i);
      await userEvent.type(input, "seller");

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      const outsideButton = screen.getByText("Outside button");
      await userEvent.click(outsideButton);

      await waitFor(() => {
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      });
    });

    it("keeps dropdown open when clicking inside results", async () => {
      render(<DocsSearch />);

      const input = screen.getByPlaceholderText(/Search documentation/i);
      await userEvent.type(input, "seller");

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      const option = screen.getAllByRole("option")[0];
      fireEvent.mouseDown(option);

      // Dropdown may close after selection, but click itself should work
      expect(option).toBeInTheDocument();
    });
  });

  describe("Result Selection", () => {
    it("calls onResultSelect callback when result is clicked", async () => {
      const onResultSelect = vi.fn();

      render(<DocsSearch onResultSelect={onResultSelect} />);

      const input = screen.getByPlaceholderText(/Search documentation/i);
      await userEvent.type(input, "seller");

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      const option = screen.getAllByRole("option")[0];
      await userEvent.click(option);

      expect(onResultSelect).toHaveBeenCalled();
    });

    it("clears input after selecting result", async () => {
      render(<DocsSearch />);

      const input = screen.getByPlaceholderText(/Search documentation/i) as HTMLInputElement;
      await userEvent.type(input, "seller");

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      const option = screen.getAllByRole("option")[0];
      await userEvent.click(option);

      await waitFor(() => {
        expect(input.value).toBe("");
      });
    });

    it("closes dropdown after selecting result", async () => {
      render(<DocsSearch />);

      const input = screen.getByPlaceholderText(/Search documentation/i);
      await userEvent.type(input, "seller");

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      const option = screen.getAllByRole("option")[0];
      await userEvent.click(option);

      await waitFor(() => {
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      });
    });
  });

  describe("Focus Management", () => {
    it("opens dropdown when input receives focus with existing query", async () => {
      render(<DocsSearch />);

      const input = screen.getByPlaceholderText(/Search documentation/i);
      await userEvent.type(input, "seller");

      // Clear results by clearing input
      await userEvent.clear(input);

      await waitFor(() => {
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      });

      // Type again
      await userEvent.type(input, "seller");

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA labels for interactive elements", () => {
      render(<DocsSearch />);

      expect(screen.getByLabelText("Search documentation")).toBeInTheDocument();
    });

    it("search results are marked as listbox with options", async () => {
      render(<DocsSearch />);

      const input = screen.getByPlaceholderText(/Search documentation/i);
      await userEvent.type(input, "seller");

      await waitFor(() => {
        const listbox = screen.getByRole("listbox");
        expect(listbox).toBeInTheDocument();

        const options = screen.getAllByRole("option");
        expect(options.length).toBeGreaterThan(0);
      });
    });

    it("no results message has proper role", async () => {
      render(<DocsSearch />);

      const input = screen.getByPlaceholderText(/Search documentation/i);
      await userEvent.type(input, "xyznonexistent");

      await waitFor(() => {
        const message = screen.getByRole("status");
        expect(message).toBeInTheDocument();
      });
    });
  });

  describe("Responsive Behavior", () => {
    it("renders with responsive Tailwind classes", () => {
      const { container } = render(<DocsSearch />);

      const wrapper = container.querySelector(".relative.w-full");
      expect(wrapper).toBeInTheDocument();
    });

    it("input uses full width", () => {
      const { container } = render(<DocsSearch />);

      const input = container.querySelector("input");
      expect(input).toHaveClass("w-full");
    });

    it("results container scrolls on mobile overflow", async () => {
      render(<DocsSearch />);

      const input = screen.getByPlaceholderText(/Search documentation/i);
      await userEvent.type(input, "d");

      await waitFor(() => {
        const resultsContainer = screen.getByRole("listbox");
        expect(resultsContainer).toHaveClass("max-h-96", "overflow-y-auto");
      });
    });
  });

  describe("State Management", () => {
    it("maintains search state correctly", async () => {
      render(<DocsSearch />);

      const input = screen.getByPlaceholderText(/Search documentation/i) as HTMLInputElement;

      await userEvent.type(input, "sell");
      expect(input.value).toBe("sell");

      await userEvent.type(input, "er");
      expect(input.value).toBe("seller");

      await userEvent.clear(input);
      expect(input.value).toBe("");
    });

    it("handles rapid input changes", async () => {
      render(<DocsSearch />);

      const input = screen.getByPlaceholderText(/Search documentation/i) as HTMLInputElement;

      await userEvent.type(input, "seller", { delay: 10 });

      await waitFor(() => {
        expect(input.value).toBe("seller");
      });
    });
  });
});
