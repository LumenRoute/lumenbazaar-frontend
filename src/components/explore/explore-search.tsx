"use client";

import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/surfaces";
import { queryKeys } from "@/services/api/query";
import { searchCatalog, type ResourceSort } from "@/services/catalog";

type ExploreSearchProps = {
  initialQuery: string;
  initialSort: ResourceSort;
};

const sortOptions: Array<{ label: string; value: ResourceSort }> = [
  { label: "Relevance", value: "relevance" },
  { label: "Price low to high", value: "price-asc" },
  { label: "Price high to low", value: "price-desc" },
  { label: "Recently updated", value: "recent" }
];

export function ExploreSearch({ initialQuery, initialSort }: ExploreSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState<ResourceSort>(initialSort);
  const { data, isFetching } = useQuery({
    queryFn: () => searchCatalog({ q: initialQuery, sort }),
    queryKey: queryKeys.search({ q: initialQuery, sort })
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

    router.push(`/explore${params.size > 0 ? `?${params.toString()}` : ""}`);
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardBody>
          <form className="grid gap-3 lg:grid-cols-[1fr_220px_auto]" onSubmit={submitSearch}>
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
          </form>
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={data?.source === "api" ? "success" : "warning"}>
            {data?.source === "api" ? "API results" : "Demo results"}
          </Badge>
          {data?.partialResults ? <Badge tone="warning">Partial results</Badge> : null}
        </div>
        <p className="text-sm text-slate-600">
          {isFetching ? "Refreshing" : `${data?.resources.length ?? 0} resources`}
        </p>
      </div>

      {data !== undefined && data.resources.length === 0 ? (
        <EmptyState
          title="No resources matched"
          description="Try a broader query or remove filters when filter controls are available."
        />
      ) : null}

      <div className="grid gap-3" aria-live="polite">
        {data?.resources.map((resource) => (
          <Card key={resource.id}>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-950">{resource.name}</h2>
                <p className="mt-1 text-sm text-slate-600">{resource.description}</p>
              </div>
              <Badge tone={resource.type === "http" ? "info" : "neutral"}>{resource.type}</Badge>
            </CardHeader>
            <CardBody className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-4">
              <span>{resource.network}</span>
              <span>{resource.assetCode}</span>
              <span>{resource.amount}</span>
              <span className="truncate">{resource.routeTemplate}</span>
            </CardBody>
          </Card>
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
