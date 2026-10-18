import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { demoResources } from "@/fixtures/lumenbazaar";
import { parseDiscoveryState } from "@/services/discovery-params";

import { ExploreSearch } from "./explore-search";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  searchCatalog: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: vi.fn() })
}));

vi.mock("@/services/catalog", () => ({
  searchCatalog: mocks.searchCatalog
}));

function searchResult(resources = demoResources) {
  return {
    fetchedAt: "2026-10-18T12:00:00.000Z",
    nextCursor: null,
    partialResults: false,
    ranking: { strategy: "fixture-text-search" },
    resources,
    source: "demo" as const
  };
}

beforeEach(() => {
  mocks.push.mockReset();
  mocks.searchCatalog.mockReset();
  mocks.searchCatalog.mockResolvedValue(searchResult());
});

function renderExplore(initialState: ReturnType<typeof parseDiscoveryState>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ExploreSearch initialState={initialState} />
    </QueryClientProvider>
  );
}

describe("ExploreSearch", () => {
  it("restores a copied deep link and requests the decoded state", async () => {
    const initialState = parseDiscoveryState({
      cursor: "cursor_page_2",
      maxPrice: "0.20",
      minPrice: "0.05",
      network: "stellar:testnet",
      q: "weather",
      sellerVerification: "verified",
      sort: "price-desc",
      type: "http"
    });

    renderExplore(initialState);

    expect(screen.getByLabelText("Search resources")).toHaveValue("weather");
    expect(screen.getByLabelText("Network")).toHaveValue("stellar:testnet");
    expect(screen.getByLabelText("Resource type")).toHaveValue("http");
    expect(screen.getByLabelText("Seller verification")).toHaveValue("verified");
    expect(screen.getByLabelText("Minimum price")).toHaveValue("0.05");
    expect(screen.getByLabelText("Maximum price")).toHaveValue("0.20");
    expect(await screen.findByText("Paid Weather API")).toBeInTheDocument();

    expect(mocks.searchCatalog).toHaveBeenCalledWith({
      asset: undefined,
      cursor: "cursor_page_2",
      extension: undefined,
      maxPrice: "0.20",
      minPrice: "0.05",
      network: "stellar:testnet",
      q: "weather",
      sellerVerification: "verified",
      sort: "price-desc",
      type: "http"
    });
  });

  it("writes submitted searches and filters back to the URL", async () => {
    renderExplore(parseDiscoveryState(undefined));

    await userEvent.type(screen.getByLabelText("Search resources"), "weather");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(mocks.push).toHaveBeenLastCalledWith("/explore?q=weather");

    await userEvent.selectOptions(screen.getByLabelText("Network"), "stellar:testnet");

    expect(mocks.push).toHaveBeenLastCalledWith("/explore?q=weather&network=stellar%3Atestnet");
  });

  it("builds a bounded comparison link from selected results", async () => {
    renderExplore(parseDiscoveryState(undefined));

    expect(await screen.findAllByRole("checkbox")).toHaveLength(2);

    const checkboxes = screen.getAllByRole("checkbox");
    await userEvent.click(checkboxes[0]!);
    await userEvent.click(checkboxes[1]!);

    expect(screen.getByRole("link", { name: "Compare selected" })).toHaveAttribute(
      "href",
      `/explore/compare?ids=${encodeURIComponent(
        `${demoResources[0]!.id},${demoResources[1]!.id}`
      )}`
    );
  });
});
