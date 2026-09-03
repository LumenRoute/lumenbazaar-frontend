import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "./page";

describe("home page scaffold", () => {
  it("renders the LumenBazaar application name", () => {
    render(<HomePage />);

    expect(screen.getByText("LumenBazaar")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Stellar x402 resource discovery"
    );
  });
});
