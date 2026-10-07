import { apiClient, type LumenBazaarApiClient } from "@/services/api/client";
import type { Resource, ResourceType, SearchResult } from "@/services/api/schemas";
import type { NetworkId } from "@/config/networks";
import { isDemoMode, type RuntimeEnvironment } from "@/config/runtime";

import { demoResources } from "@/fixtures/lumenbazaar";
import { currentRuntimeMode } from "@/services/runtime-mode";

export type ResourceSort = "relevance" | "price-asc" | "price-desc" | "recent";

export type ExploreSearchInput = {
  asset?: string;
  cursor?: string;
  extension?: "bazaar" | "mcp";
  maxPrice?: string;
  minPrice?: string;
  network?: NetworkId;
  q?: string;
  sellerVerification?: "any" | "verified" | "unverified";
  sort?: ResourceSort;
  type?: ResourceType;
};

export type ExploreSearchResult = SearchResult & {
  source: "api" | "demo";
};

type CatalogClient = Pick<LumenBazaarApiClient, "searchResources">;

export async function searchCatalog(
  input: ExploreSearchInput,
  client: CatalogClient = apiClient,
  mode: RuntimeEnvironment = currentRuntimeMode()
): Promise<ExploreSearchResult> {
  if (isDemoMode(mode)) {
    return {
      nextCursor: null,
      partialResults: false,
      ranking: {
        strategy: "fixture-text-search"
      },
      resources: sortResources(filterDemoResources(input), input.sort ?? "relevance").map(
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

  const result = await client.searchResources({
    cursor: input.cursor,
    extension: input.extension,
    limit: 12,
    maxPrice: input.maxPrice,
    minPrice: input.minPrice,
    network: input.network,
    q: input.q,
    sellerVerified:
      input.sellerVerification === "any" ? undefined : input.sellerVerification === "verified",
    type: input.type
  });

  return {
    ...sortSearchResult(result, input.sort ?? "relevance"),
    source: "api"
  };
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

function filterDemoResources(input: ExploreSearchInput) {
  const terms = tokenize(input.q ?? "");

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

    return (
      (terms.length === 0 || terms.every((term) => body.includes(term))) &&
      (input.network === undefined || resource.network === input.network) &&
      (input.type === undefined || resource.type === input.type) &&
      (input.extension === undefined || Boolean(resource.extensions[input.extension])) &&
      (input.minPrice === undefined || Number(resource.amount) >= Number(input.minPrice)) &&
      (input.maxPrice === undefined || Number(resource.amount) <= Number(input.maxPrice)) &&
      (input.sellerVerification === undefined ||
        input.sellerVerification === "any" ||
        (input.sellerVerification === "verified" && resource.extensions.trusted === true) ||
        (input.sellerVerification === "unverified" && resource.extensions.trusted !== true))
    );
  });
}

function tokenize(query: string) {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 0);
}
