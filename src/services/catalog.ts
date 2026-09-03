import { apiClient, type LumenBazaarApiClient } from "@/services/api/client";
import type { Resource, SearchResult } from "@/services/api/schemas";

import { demoResources } from "@/fixtures/lumenbazaar";

export type ResourceSort = "relevance" | "price-asc" | "price-desc" | "recent";

export type ExploreSearchInput = {
  cursor?: string;
  q?: string;
  sort?: ResourceSort;
};

export type ExploreSearchResult = SearchResult & {
  source: "api" | "demo";
};

type CatalogClient = Pick<LumenBazaarApiClient, "searchResources">;

export async function searchCatalog(
  input: ExploreSearchInput,
  client: CatalogClient = apiClient
): Promise<ExploreSearchResult> {
  try {
    const result = await client.searchResources({
      cursor: input.cursor,
      limit: 12,
      q: input.q
    });

    return {
      ...sortSearchResult(result, input.sort ?? "relevance"),
      source: "api"
    };
  } catch {
    return {
      nextCursor: null,
      partialResults: false,
      ranking: {
        strategy: "fixture-text-search"
      },
      resources: sortResources(filterDemoResources(input.q), input.sort ?? "relevance").map(
        (resource, index) => ({
          ...resource,
          ranking: {
            matchedTerms: tokenize(input.q ?? ""),
            score: 100 - index
          }
        })
      ),
      source: "demo"
    };
  }
}

export function sortSearchResult(result: SearchResult, sort: ResourceSort): SearchResult {
  return {
    ...result,
    resources: sortResources(result.resources, sort)
  };
}

export function sortResources<TResource extends Resource>(
  resources: TResource[],
  sort: ResourceSort
) {
  return [...resources].sort((left, right) => {
    if (sort === "price-asc") {
      return Number(left.amount) - Number(right.amount) || left.name.localeCompare(right.name);
    }

    if (sort === "price-desc") {
      return Number(right.amount) - Number(left.amount) || left.name.localeCompare(right.name);
    }

    if (sort === "recent") {
      return right.updatedAt.localeCompare(left.updatedAt) || left.name.localeCompare(right.name);
    }

    return left.name.localeCompare(right.name);
  });
}

function filterDemoResources(query: string | undefined) {
  const terms = tokenize(query ?? "");

  if (terms.length === 0) {
    return demoResources;
  }

  return demoResources.filter((resource) => {
    const body = [
      resource.name,
      resource.description,
      resource.assetCode,
      resource.network,
      resource.type,
      resource.routeTemplate
    ]
      .join(" ")
      .toLowerCase();

    return terms.every((term) => body.includes(term));
  });
}

function tokenize(query: string) {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 0);
}
