"use client";

import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { DataFreshnessBadge } from "@/components/ui/data-freshness-badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { ResourceCard } from "@/components/resources/resource-card";
import { EmptyState, ErrorState } from "@/components/ui/surfaces";
import { queryKeys } from "@/services/api/query";
import { searchCatalog, type ExploreSearchInput, type ResourceSort } from "@/services/catalog";
import { normalizeUiError } from "@/services/ui-state";

type ExploreSearchProps = {
  initialFilters: Omit<ExploreSearchInput, "cursor" | "q" | "sort">;
  initialQuery: string;
  initialSort: ResourceSort;
};

const sortOptions: Array<{ label: string; value: ResourceSort }> = [
  { label: "Relevance", value: "relevance" },
  { label: "Price low to high", value: "price-asc" },
  { label: "Price high to low", value: "price-desc" },
  { label: "Recently updated", value: "recent" }
];

export function ExploreSearch({ initialFilters, initialQuery, initialSort }: ExploreSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState<ResourceSort>(initialSort);
  const { data, error, isFetching, refetch } = useQuery({
    queryFn: () => searchCatalog({ ...initialFilters, q: initialQuery, sort }),
    queryKey: queryKeys.search({ ...initialFilters, q: initialQuery, sort })
  });

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();

    if (query.trim().length > 0) {
      params.set("q", query.trim());
    }

    if (sort !== "relevance") {
      params.set("sort", sort);
    }

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== "" && value !== "any") {
        params.set(key, String(value));
      }
    }

    router.push(`/explore${params.size > 0 ? `?${params.toString()}` : ""}`);
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardBody>
          <form className="space-y-4" onSubmit={submitSearch}>
            <div className="grid gap-3 lg:grid-cols-[1fr_220px_auto]">
              <label className="flex min-h-11 items-center gap-3 rounded-md border border-slate-300 bg-white px-3 focus-within:border-teal-700 focus-within:ring-2 focus-within:ring-teal-100">
                <Search aria-hidden="true" className="h-5 w-5 text-slate-400" />
                <span className="sr-only">Search resources</span>
                <input
                  className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search APIs, MCP tools, schemas, or assets"
                  value={query}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="sr-only">Sort resources</span>
                <select
                  className="min-h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                  onChange={(event) => setSort(event.target.value as ResourceSort)}
                  value={sort}
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit">Search</Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <select
                aria-label="Network"
                className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    network: event.target.value === "" ? undefined : (event.target.value as never)
                  }))
                }
                value={filters.network ?? ""}
              >
                <option value="">All networks</option>
                <option value="stellar:testnet">stellar:testnet</option>
                <option value="stellar:pubnet">stellar:pubnet</option>
              </select>
              <input
                aria-label="Asset"
                className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    asset: event.target.value.trim() === "" ? undefined : event.target.value
                  }))
                }
                placeholder="Asset"
                value={filters.asset ?? ""}
              />
              <select
                aria-label="Resource type"
                className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    type: event.target.value === "" ? undefined : (event.target.value as never)
                  }))
                }
                value={filters.type ?? ""}
              >
                <option value="">All types</option>
                <option value="http">HTTP</option>
                <option value="mcp">MCP</option>
              </select>
              <select
                aria-label="Seller verification"
                className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    sellerVerification: event.target
                      .value as ExploreSearchInput["sellerVerification"]
                  }))
                }
                value={filters.sellerVerification ?? "any"}
              >
                <option value="any">Any seller</option>
                <option value="verified">Verified seller</option>
                <option value="unverified">Unverified seller</option>
              </select>
              <select
                aria-label="Extension"
                className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    extension: event.target.value === "" ? undefined : (event.target.value as never)
                  }))
                }
                value={filters.extension ?? ""}
              >
                <option value="">All extensions</option>
                <option value="bazaar">Bazaar</option>
                <option value="mcp">MCP</option>
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  aria-label="Minimum price"
                  className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      minPrice: event.target.value.trim() === "" ? undefined : event.target.value
                    }))
                  }
                  placeholder="Min"
                  value={filters.minPrice ?? ""}
                />
                <input
                  aria-label="Maximum price"
                  className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      maxPrice: event.target.value.trim() === "" ? undefined : event.target.value
                    }))
                  }
                  placeholder="Max"
                  value={filters.maxPrice ?? ""}
                />
              </div>
            </div>
          </form>
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {data ? (
            <Badge tone={data.source === "api" ? "success" : "warning"}>
              {data.source === "api" ? "API results" : "Explicit demo results"}
            </Badge>
          ) : null}
          {data?.partialResults ? <Badge tone="warning">Partial results</Badge> : null}
          {data ? <DataFreshnessBadge observedAt={data.fetchedAt} source={data.source} /> : null}
        </div>
        <p className="text-sm text-slate-600">
          {isFetching ? "Refreshing" : `${data?.resources.length ?? 0} resources`}
        </p>
      </div>

      {data === undefined && error !== null ? (
        <ErrorState
          {...normalizeUiError(error, {
            code: "BACKEND_UNAVAILABLE",
            description: "Resource discovery could not be verified against the configured backend.",
            title: "Catalog unavailable"
          })}
          onRetry={() => void refetch()}
        />
      ) : null}

      {data !== undefined && data.resources.length === 0 ? (
        <EmptyState
          title="No resources matched"
          description="Try a broader query or remove filters when filter controls are available."
        />
      ) : null}

      <div className="grid gap-3" aria-live="polite">
        {data?.resources.map((resource) => (
          <ResourceCard
            key={resource.id}
            partialResults={data.partialResults}
            resource={resource}
          />
        ))}
      </div>

      {data?.nextCursor ? (
        <Button type="button" variant="secondary">
          Load more
        </Button>
      ) : null}
    </div>
  );
}
