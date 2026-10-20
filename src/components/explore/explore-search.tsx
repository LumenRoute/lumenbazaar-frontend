"use client";

import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { DataFreshnessBadge } from "@/components/ui/data-freshness-badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { ResourceCard } from "@/components/resources/resource-card";
import { EmptyState, ErrorState } from "@/components/ui/surfaces";
import {
  discoveryDefaults,
  discoveryHref,
  emptyDiscoveryState,
  resourceSorts,
  toExploreSearchInput,
  type DiscoveryState
} from "@/services/discovery-params";
import { maxComparisonResources } from "@/services/resource-comparison";
import { queryKeys } from "@/services/api/query";
import { searchCatalog, type ResourceSort } from "@/services/catalog";
import { normalizeUiError } from "@/services/ui-state";

type ExploreSearchProps = {
  initialState: DiscoveryState;
};

const sortOptions: Array<{ label: string; value: ResourceSort }> = [
  { label: "Relevance", value: "relevance" },
  { label: "Price low to high", value: "price-asc" },
  { label: "Price high to low", value: "price-desc" },
  { label: "Recently updated", value: "recent" }
];

export function ExploreSearch({ initialState }: ExploreSearchProps) {
  const router = useRouter();
  const [state, setState] = useState<DiscoveryState>(initialState);
  const [queryDraft, setQueryDraft] = useState(initialState.q);
  const [priceDrafts, setPriceDrafts] = useState<DiscoveryState>(initialState);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const request = toExploreSearchInput(state);
  const { data, error, isFetching, refetch } = useQuery({
    queryFn: () => searchCatalog(request),
    queryKey: queryKeys.search(request)
  });
  // A failed request must never be presented as an empty result set, and stale
  // results must not survive an outage. Both cases use the explicit unavailable
  // state below, while a successful empty response keeps the empty state.
  const unavailable = error !== null;

  function goTo(next: DiscoveryState) {
    setState(next);
    setPriceDrafts(next);
    router.push(discoveryHref(next));
  }

  function withDrafts(next: DiscoveryState): DiscoveryState {
    return {
      ...next,
      asset: priceDrafts.asset,
      maxPrice: priceDrafts.maxPrice,
      minPrice: priceDrafts.minPrice
    };
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    goTo({ ...withDrafts(state), cursor: undefined, q: queryDraft.trim() });
  }

  function toggleComparison(id: string) {
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((selected) => selected !== id);
      if (current.length >= maxComparisonResources) return current;

      return [...current, id];
    });
  }

  const filters = state;

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
                  onChange={(event) => setQueryDraft(event.target.value)}
                  placeholder="Search APIs, MCP tools, schemas, or assets"
                  value={queryDraft}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="sr-only">Sort resources</span>
                <select
                  className="min-h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                  onChange={(event) => {
                    const sort = resourceSorts.includes(event.target.value as ResourceSort)
                      ? (event.target.value as ResourceSort)
                      : discoveryDefaults.sort;
                    goTo(withDrafts({ ...state, cursor: undefined, sort }));
                  }}
                  value={state.sort}
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
                  goTo(
                    withDrafts({
                      ...state,
                      cursor: undefined,
                      network: event.target.value === "" ? undefined : (event.target.value as never)
                    })
                  )
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
                  setPriceDrafts((current) => ({
                    ...current,
                    asset: event.target.value.trim() === "" ? undefined : event.target.value
                  }))
                }
                placeholder="Asset"
                value={priceDrafts.asset ?? ""}
              />
              <select
                aria-label="Resource type"
                className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                onChange={(event) =>
                  goTo(
                    withDrafts({
                      ...state,
                      cursor: undefined,
                      type: event.target.value === "" ? undefined : (event.target.value as never)
                    })
                  )
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
                  goTo(
                    withDrafts({
                      ...state,
                      cursor: undefined,
                      sellerVerification: event.target.value as DiscoveryState["sellerVerification"]
                    })
                  )
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
                  goTo(
                    withDrafts({
                      ...state,
                      cursor: undefined,
                      extension:
                        event.target.value === "" ? undefined : (event.target.value as never)
                    })
                  )
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
                    setPriceDrafts((current) => ({
                      ...current,
                      minPrice: event.target.value.trim() === "" ? undefined : event.target.value
                    }))
                  }
                  placeholder="Min"
                  value={priceDrafts.minPrice ?? ""}
                />
                <input
                  aria-label="Maximum price"
                  className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                  onChange={(event) =>
                    setPriceDrafts((current) => ({
                      ...current,
                      maxPrice: event.target.value.trim() === "" ? undefined : event.target.value
                    }))
                  }
                  placeholder="Max"
                  value={priceDrafts.maxPrice ?? ""}
                />
              </div>
            </div>
          </form>
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {unavailable ? <Badge tone="danger">Catalog unavailable</Badge> : null}
          {!unavailable && data ? (
            <Badge tone={data.source === "api" ? "success" : "warning"}>
              {data.source === "api" ? "API results" : "Explicit demo results"}
            </Badge>
          ) : null}
          {!unavailable && data?.partialResults ? (
            <Badge tone="warning">Partial results</Badge>
          ) : null}
          {!unavailable && data ? (
            <DataFreshnessBadge observedAt={data.fetchedAt} source={data.source} />
          ) : null}
          {state.cursor ? <Badge tone="info">Cursor page</Badge> : null}
        </div>
        <p className="text-sm text-slate-600">
          {unavailable
            ? "Results unavailable"
            : isFetching
              ? "Refreshing"
              : data === undefined
                ? "Loading resources"
                : `${data.resources.length} resources`}
        </p>
      </div>

      <Card>
        <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-950">
              Compare ({selectedIds.length}/{maxComparisonResources})
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Select two or more results to compare payment terms, schemas, and evidence.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              aria-disabled={selectedIds.length < 2}
              className={
                selectedIds.length < 2
                  ? "pointer-events-none inline-flex min-h-10 items-center justify-center rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-400"
                  : "inline-flex min-h-10 items-center justify-center rounded-md border border-teal-700 bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
              }
              href={`/explore/compare?ids=${encodeURIComponent(selectedIds.join(","))}`}
            >
              Compare selected
            </Link>
            <Button
              disabled={selectedIds.length === 0}
              onClick={() => setSelectedIds([])}
              type="button"
              variant="secondary"
            >
              Clear
            </Button>
          </div>
        </CardBody>
      </Card>

      {state.cursor ? (
        <p className="text-sm text-slate-600">
          Showing results after a copied cursor.{" "}
          <Link
            className="font-medium text-teal-700 underline"
            href={discoveryHref({ ...state, cursor: undefined })}
          >
            Start from the first page
          </Link>
          .
        </p>
      ) : null}

      {unavailable ? (
        <div role="alert">
          <ErrorState
            {...normalizeUiError(error, {
              code: "BACKEND_UNAVAILABLE",
              description:
                "Resource discovery could not be verified against the configured backend.",
              title: "Catalog unavailable"
            })}
            onRetry={() => void refetch()}
          />
        </div>
      ) : null}

      {!unavailable && data !== undefined && data.resources.length === 0 ? (
        <EmptyState
          title="No resources matched"
          description="Try a broader query or remove filters. Shareable links keep every filter in the URL."
        />
      ) : null}

      <div className="grid gap-3" aria-live="polite">
        {!unavailable &&
          data?.resources.map((resource) => (
            <ResourceCard
              compare={{
                disabled: selectedIds.length >= maxComparisonResources,
                onToggle: () => toggleComparison(resource.id),
                selected: selectedIds.includes(resource.id)
              }}
              key={resource.id}
              partialResults={data.partialResults}
              resource={resource}
            />
          ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {!unavailable && data?.nextCursor ? (
          <Button
            onClick={() => goTo({ ...state, cursor: data.nextCursor ?? undefined })}
            type="button"
            variant="secondary"
          >
            Load more
          </Button>
        ) : null}
        {state.cursor || state.q.length > 0 ? (
          <Button
            onClick={() => {
              const reset = emptyDiscoveryState();
              setQueryDraft(reset.q);
              goTo(reset);
            }}
            type="button"
            variant="secondary"
          >
            Reset discovery
          </Button>
        ) : null}
      </div>
    </div>
  );
}
