import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { demoPaymentRequirements } from "@/fixtures/lumenbazaar";

import { PaymentRequirementViewer } from "./payment-requirement-viewer";

describe("PaymentRequirementViewer", () => {
  it("renders catalog terms without claiming they are the live challenge", () => {
    render(<PaymentRequirementViewer requirement={demoPaymentRequirements[0]!} />);

    expect(screen.getByText("Catalog payment summary")).toBeInTheDocument();
    expect(screen.getByText(/paid endpoint challenge is authoritative/i)).toBeInTheDocument();
    expect(screen.getByText("stellar:testnet")).toBeInTheDocument();
    expect(screen.getByText("0.0500000 USDC")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copy JSON/i })).toBeInTheDocument();
  });
});
