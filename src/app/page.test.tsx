import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createQueryClient } from "@/services/api/query";

import HomePage from "./page";

describe("home page scaffold", () => {
  it("renders the LumenBazaar application name", () => {
    render(
      <QueryClientProvider client={createQueryClient()}>
        <HomePage />
      </QueryClientProvider>
    );

    expect(screen.getByText("LumenBazaar dashboard")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("LumenBazaar dashboard");
  });
});
