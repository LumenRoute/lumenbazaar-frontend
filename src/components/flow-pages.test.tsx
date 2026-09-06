import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DocsIndex } from "@/components/docs/docs-index";
import { OperatorHealthTable } from "@/components/operators/operator-health-table";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { TransactionDashboard } from "@/components/transactions/transaction-dashboard";
import type { OperatorHealthRow } from "@/services/operators";

describe("implemented flow pages", () => {
  it("filters transaction rows by status", () => {
    render(<TransactionDashboard />);

    expect(screen.getByRole("heading", { name: "Transactions" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "failed" }
    });

    expect(screen.getByText("AUTH_EXPIRED")).toBeInTheDocument();
    expect(screen.queryByText("attempt_rag_001")).not.toBeInTheDocument();
  });

  it("renders health rows with accessible service status", () => {
    render(<OperatorHealthTable rows={healthRows} />);

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("API")).toBeInTheDocument();
    expect(screen.getByText("Stellar RPC reachable.")).toBeInTheDocument();
  });

  it("renders canonical docs links and MCP contracts", () => {
    render(<DocsIndex />);

    expect(screen.getByText("Seller docs")).toBeInTheDocument();
    expect(screen.getByText("MCP tool inspector")).toBeInTheDocument();
    expect(screen.getByDisplayValue("search_paid_resources")).toBeInTheDocument();
  });

  it("saves local settings from form controls", () => {
    window.localStorage.clear();
    render(<SettingsPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Manual" }));
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    expect(screen.getByText("Settings saved locally.")).toBeInTheDocument();
    expect(window.localStorage.getItem("lumenbazaar.frontend.settings.v1")).toContain("manual");
  });
});

const healthRows: OperatorHealthRow[] = [
  {
    checkedAt: "2026-09-02T16:06:00.000Z",
    detail: "API returned ok.",
    name: "API",
    status: "operational"
  },
  {
    checkedAt: "2026-09-02T16:05:35.000Z",
    detail: "Stellar RPC reachable.",
    name: "RPC",
    status: "operational"
  }
];
