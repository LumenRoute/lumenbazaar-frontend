"use client";

import { useEffect, useState } from "react";
import { RotateCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const staleAfterMs = 60_000;

export type DataFreshnessBadgeProps = {
  observedAt: string;
  source: "api" | "demo" | "partial" | "unavailable";
  onRefresh?: () => void | Promise<void>;
  isRefreshing?: boolean;
};

export function DataFreshnessBadge({
  observedAt,
  source,
  onRefresh,
  isRefreshing = false
}: DataFreshnessBadgeProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const state = dataFreshnessState(observedAt, source, now);
  const isStale = state === "stale";

  return (
    <div className="flex items-center gap-2">
      <Badge tone={isStale ? "warning" : "neutral"}>
        {freshnessLabel(state, observedAt)}
      </Badge>
      {isStale && onRefresh && (
        <Button
          onClick={onRefresh}
          disabled={isRefreshing}
          variant="secondary"
          type="button"
          aria-label="Refresh stale results"
          title="Refresh results to get fresh data"
          className={cn(
            "px-2 py-1 text-xs gap-1",
            isRefreshing && "cursor-wait"
          )}
        >
          {isRefreshing ? (
            <>
              <RotateCw className="h-3 w-3 animate-spin" aria-hidden="true" />
              <span className="sr-only">Refreshing</span>
            </>
          ) : (
            <>
              <RotateCw className="h-3 w-3" aria-hidden="true" />
              Refresh
            </>
          )}
        </Button>
      )}
    </div>
  );
}

export function dataFreshnessState(
  observedAt: string,
  source: "api" | "demo" | "partial" | "unavailable",
  now = Date.now()
) {
  if (source === "demo") return "demo" as const;

  const observed = Date.parse(observedAt);
  if (!Number.isFinite(observed) || now - observed > staleAfterMs) return "stale" as const;

  return "fresh" as const;
}

export function getResultAge(observedAt: string, now = Date.now()): number {
  const observed = Date.parse(observedAt);
  if (!Number.isFinite(observed)) return -1;
  return now - observed;
}

export function isResultStale(observedAt: string, now = Date.now()): boolean {
  return getResultAge(observedAt, now) > staleAfterMs;
}

function freshnessLabel(state: ReturnType<typeof dataFreshnessState>, observedAt: string) {
  const timestamp = new Date(observedAt).toLocaleString();
  if (state === "demo") return `Loaded ${timestamp}`;
  if (state === "stale") return `Potentially stale · observed ${timestamp}`;
  return `Fresh · observed ${timestamp}`;
}
