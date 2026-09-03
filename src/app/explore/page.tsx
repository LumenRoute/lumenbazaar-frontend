import { PageHeader } from "@/components/layout/page-header";
import { ExploreSearch } from "@/components/explore/explore-search";
import type { ResourceSort } from "@/services/catalog";

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

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const params = await searchParams;

  return (
    <>
      <PageHeader
        title="Explore"
        description="Search paid HTTP APIs and MCP tools indexed by the Bazaar discovery layer."
      />
      <ExploreSearch
        initialQuery={first(params.q) ?? ""}
        initialSort={parseSort(first(params.sort))}
      />
    </>
  );
}
