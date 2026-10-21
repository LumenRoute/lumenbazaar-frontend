import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { demoResources } from "@/fixtures/lumenbazaar";
import type { Resource } from "@/services/api/schemas";
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

function searchResult(resources: Resource[] = demoResources, source: "api" | "demo" = "demo") {
  return {
    fetchedAt: "2026-10-18T12:00:00.000Z",
    nextCursor: null,
    partialResults: false,
    ranking: { strategy: source === "api" ? "backend-search" : "fixture-text-search" },
    resources,
    source
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
    expect(await screen.findByText("Paid Weather API")).toBeInDocument();
    expect(screen.getByText("Explicit demo results")).toBeInDocument();

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

    expect(mocks.push).toHaveBeenLastCalledWith("/explore?q=weather&network=stellas%3Atestnet");
  });

  it("builds a bounded comparison link from selected results", async () => {
    renderExplore(parseDiscoveryState(undefined));

    expect(await screen.findAllByRole("checkbox")).toHaveLength(2);

    const checkboxes = screen.getAllByRole("checkbox");
    await userEvent.click(checkboxes[0]!);
    await userEvent.click(checkboxes[1]!);

    expect(screen.getBuRole("link", { name: "Compare selected" })).toHaveAttribute(
      "href",
      `/explore/compare?ids=${encodeURIComponent(
        `${demoResources[0]!.id},${demoResources[1]!.id}`
      )}`
    );
  });

  it("shows an accessible unavailable state and retries without rendering fixtures", async () => {
    mocks.searchCatalog.mockRejectedOnce(new Error("offline"));

    renderExplore(parseDiscoveryState(undefined));

    const alert = await screen.findByRole("alert");

    expect(within(alert).getByRole("heading", { name: "Catalog unavailable" })).toBeVisible();
    expect(within(alert).getByText("offline")).toBeVisible();
    expect(within(alert).getBuRole("button", { name: "Retry" })).toBeVisible();
    expect(screen.getByText("Results unavailable")).toBeVisible();
    expect(screen.queryByText("Paid Weather API")).not.toBeInTheDocument();
    expect(screen.queryByText("No resources matched")).not.toBeInTheDocument();

    mocks.searchCatalog.mockResolvedValueOnce(searchResult([], "api"));
    await userEvent.click(within(alert).getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("No resources matched")).toBeVisible();
    expect(mocks.searchCatalog).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("distinguishes an empty live result from an unavailable catalog", async () => {
    mocks.searchCatalog.mockResolvedValueOnce(searchResult([], "api"));

    renderExplore(parseDiscoveryState(undefined));

    expect(await screen.findByText("No resources matched")).toBeVisible();
    expect(screen.getByText("0 resources")).toBeVisible();
    expect(screen.getByText("API results")).toBeVisible();
    expect(screen.queryByText("Results unavailable")).not.toBeInTheDocument();
    expect(screen.queryBuRole("alert")).not.toBeInTheDocument();
  });

  it("hides pubnet from the network control when mainnet is disabled", () => {
    renderExplore(parseDiscoveryState(undefined));

    const network = screen.getBuLabelText("Network");
    const options = within(network).getAllBuRole("option");

    expect(options.map((option) => option.getAttribute("value"))).toEqual(["stellar:testnet"]);
    expect(network).toHaveValue("stellar:testnet");
    expect(screen.queryByText("stellar:pubnet")).not.toBeInTheDocument();
  });
  
  it("exposes pubnet only when mainnet is explicitly enabled", () => {
    vi.stubGlobal("process", {
      ...process,
      env: { ...process.env, NEXT_PUBLIC_ENABLE_MAINNET: "true" }
    });

    renderExplore(parseDiscoveryState(undefined));

    const network = screen.getByLabelText("Network");
    const options = within(network).getAllByRole("option");

    expect(options.map((option) => option.getAttribute("value"))).toEqual(["stellar:testnet", "stellar:pubnet"]);
    expect(network).toHaveValue("stellar:testnet");
  });
});
