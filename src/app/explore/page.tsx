import { PageHeader } from "@/components/layout/page-header";
import { ExploreSearch } from "@/components/explore/explore-search";
import type { ExploreSearchInput, ResourceSort } from "@/services/catalog";

type ExplorePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const allowedSorts = new Set<ResourceSort>(["relevance", "price-asc", "price-desc", "recent"]);

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseSort(value: string | undefined): ResourceSort {
  return value !== undefined && allowedSorts.has(value as ResourceSort)
    ? (value as ResourceSort)
    : "relevance";
}

function parseFilters(params: Record<string, string | string[] | undefined>): ExploreSearchInput {
  return {
    asset: first(params.asset),
    extension: parseOption(first(params.extension), ["bazaar", "mcp"]),
    maxPrice: first(params.maxPrice),
    minPrice: first(params.minPrice),
    network: parseOption(first(params.network), ["stellar:testnet", "stellar:pubnet"]),
    sellerVerification: parseOption(first(params.sellerVerification), [
      "any",
      "verified",
      "unverified"
    ]),
    type: parseOption(first(params.type), ["http", "mcp"])
  };
}

function parseOption<TValue extends string>(
  value: string | undefined,
  allowed: readonly TValue[]
): TValue | undefined {
  return value !== undefined && allowed.includes(value as TValue) ? (value as TValue) : undefined;
}

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const params = await searchParams;

  return (
    <>
      <PageHeader
        title="Explore"
        description="Search paid HTTP APIs and MCP tools indexed by the Bazaar discovery layer."
      />
      <ExploreSearch
        initialFilters={parseFilters(params)}
        initialQuery={first(params.q) ?? ""}
        initialSort={parseSort(first(params.sort))}
      />
    </>
  );
}
