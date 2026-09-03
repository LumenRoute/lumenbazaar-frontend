import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SellerDomainVerifier } from "./seller-domain-verifier";

describe("SellerDomainVerifier", () => {
  it("renders challenge request controls", () => {
    render(<SellerDomainVerifier domain="rag.lumenbazaar.dev" sellerId="seller_vector_rag" />);

    expect(screen.getByText("Domain verification")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Request challenge/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Method")).toBeInTheDocument();
  });
});
