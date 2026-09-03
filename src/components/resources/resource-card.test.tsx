import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { demoResources, demoSellers } from "@/fixtures/lumenbazaar";

import { ResourceCard } from "./resource-card";

describe("ResourceCard", () => {
  it("renders scan-friendly payment and seller details", () => {
    render(<ResourceCard resource={demoResources[0]!} seller={demoSellers[0]} />);

    expect(screen.getByText("Paid Weather API")).toBeInTheDocument();
    expect(screen.getByText("weather.lumenbazaar.dev")).toBeInTheDocument();
    expect(screen.getByText("stellar:testnet")).toBeInTheDocument();
    expect(screen.getByText("USDC")).toBeInTheDocument();
    expect(screen.getByText("Verified seller")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Inspect/i })).toHaveAttribute(
      "href",
      "/resources/resource_weather_lagos"
    );
  });
});
