import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { demoPaymentRequirements } from "@/fixtures/lumenbazaar";

import { PaymentRequirementViewer } from "./payment-requirement-viewer";

describe("PaymentRequirementViewer", () => {
  it("renders exact x402 terms", () => {
    render(<PaymentRequirementViewer requirement={demoPaymentRequirements[0]!} />);

    expect(screen.getByText("Payment requirement")).toBeInTheDocument();
    expect(screen.getByText("exact")).toBeInTheDocument();
    expect(screen.getByText("stellar:testnet")).toBeInTheDocument();
    expect(screen.getByText("0.0500000 USDC")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copy JSON/i })).toBeInTheDocument();
  });
});
