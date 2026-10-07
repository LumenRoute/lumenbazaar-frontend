"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";

const staleAfterMs = 60_000;

export function DataFreshnessBadge({
  observedAt,
  source
}: {
  observedAt: string;
  source: "api" | "demo" | "partial" | "unavailable";
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const state = dataFreshnessState(observedAt, source, now);

  return (
    <Badge tone={state === "stale" ? "warning" : "neutral"}>
      {freshnessLabel(state, observedAt)}
    </Badge>
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

function freshnessLabel(state: ReturnType<typeof dataFreshnessState>, observedAt: string) {
  const timestamp = new Date(observedAt).toLocaleString();
  if (state === "demo") return `Loaded ${timestamp}`;
  if (state === "stale") return `Potentially stale · observed ${timestamp}`;
  return `Fresh · observed ${timestamp}`;
}
