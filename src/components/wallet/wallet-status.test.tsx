import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WalletStatus } from "./wallet-status";

describe("WalletStatus", () => {
  it("renders a non-custodial Freighter connect action", () => {
    render(<WalletStatus />);

    expect(screen.getByRole("button", { name: /Connect Freighter/i })).toBeInTheDocument();
  });
});
