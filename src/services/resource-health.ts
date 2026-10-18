import type { Resource } from "@/services/api/schemas";

export const probeStaleAfterMs = 24 * 60 * 60 * 1000;
export const catalogStaleAfterMs = 7 * 24 * 60 * 60 * 1000;

const clockSkewToleranceMs = 5 * 60 * 1000;

export type AvailabilityState = "healthy" | "degraded" | "unavailable" | "stale" | "unknown";
export type CatalogFreshnessState = "fresh" | "stale" | "unknown";

export type EvidenceBadge = {
  label: string;
  state: string;
  tone: "neutral" | "success" | "warning" | "danger" | "info";
  tooltip: string;
};

export type AvailabilityEvidence = EvidenceBadge & {
  lastProbeAt: string | null;
  lastSuccessfulProbeAt: string | null;
  source: string;
  state: AvailabilityState;
};

export type CatalogFreshnessEvidence = EvidenceBadge & {
  catalogUpdatedAt: string | null;
  state: CatalogFreshnessState;
};

export type ResourceHealth = {
  availability: AvailabilityEvidence;
  freshness: CatalogFreshnessEvidence;
};

const availabilityStates = ["healthy", "degraded", "unavailable", "unknown"] as const;

export function parseEvidenceTimestamp(value: unknown): number | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isAvailabilityStatus(value: unknown): value is (typeof availabilityStates)[number] {
  return typeof value === "string" && availabilityStates.includes(value as never);
}

/**
 * Resolves backend-provided availability into a presentation state.
 *
 * A missing, malformed, old, or future probe timestamp is never presented as
 * healthy: unsupported evidence fails closed to `unknown` or `stale`.
 */
export function resolveAvailability(resource: Resource, now = Date.now()): AvailabilityEvidence {
  const availability = isRecord(resource.availability) ? resource.availability : undefined;
  const source =
    typeof availability?.source === "string" && availability.source.trim().length > 0
      ? availability.source
      : "backend availability evidence";

  if (availability === undefined) {
    return {
      label: "Unknown",
      lastProbeAt: null,
      lastSuccessfulProbeAt: null,
      source,
      state: "unknown",
      tone: "neutral",
      tooltip:
        "No availability evidence has been provided by the backend. This resource is treated as unverified."
    };
  }

  const lastSuccessfulProbeAt = normalizeTimestamp(availability.lastSuccessfulProbeAt);
  const lastProbeAt = normalizeTimestamp(availability.lastProbeAt);
  const successfulProbeMs = parseEvidenceTimestamp(lastSuccessfulProbeAt);

  if (!isAvailabilityStatus(availability.status)) {
    return {
      label: "Unknown",
      lastProbeAt,
      lastSuccessfulProbeAt,
      source,
      state: "unknown",
      tone: "warning",
      tooltip: `Malformed availability evidence from ${source}. Treated as unverified until the backend reports a supported state.`
    };
  }

  if (availability.status === "unavailable") {
    return {
      label: "Unavailable",
      lastProbeAt,
      lastSuccessfulProbeAt,
      source,
      state: "unavailable",
      tone: "danger",
      tooltip: `The backend reports this resource as unavailable. Evidence source: ${source}.`
    };
  }

  if (availability.status === "unknown") {
    return {
      label: "Unknown",
      lastProbeAt,
      lastSuccessfulProbeAt,
      source,
      state: "unknown",
      tone: "neutral",
      tooltip: `The backend has not confirmed reachability. Evidence source: ${source}.`
    };
  }

  if (successfulProbeMs === null) {
    return {
      label: "Unverified",
      lastProbeAt,
      lastSuccessfulProbeAt,
      source,
      state: "unknown",
      tone: "warning",
      tooltip: `The backend reports ${availability.status} but has no successful probe timestamp. Treated as unverified. Evidence source: ${source}.`
    };
  }

  if (successfulProbeMs > now + clockSkewToleranceMs) {
    return {
      label: "Unknown",
      lastProbeAt,
      lastSuccessfulProbeAt,
      source,
      state: "unknown",
      tone: "warning",
      tooltip: `The last successful probe timestamp is in the future, so the evidence is treated as malformed. Evidence source: ${source}.`
    };
  }

  if (now - successfulProbeMs > probeStaleAfterMs) {
    return {
      label: "Stale probe",
      lastProbeAt,
      lastSuccessfulProbeAt,
      source,
      state: "stale",
      tone: "warning",
      tooltip: `Last successful probe ${formatTimestamp(lastSuccessfulProbeAt)} is older than 24 hours. Evidence source: ${source}.`
    };
  }

  if (availability.status === "degraded") {
    return {
      label: "Degraded",
      lastProbeAt,
      lastSuccessfulProbeAt,
      source,
      state: "degraded",
      tone: "warning",
      tooltip: `The last probe was reachable but reported degraded behavior at ${formatTimestamp(lastProbeAt ?? lastSuccessfulProbeAt)}. Evidence source: ${source}.`
    };
  }

  return {
    label: "Healthy",
    lastProbeAt,
    lastSuccessfulProbeAt,
    source,
    state: "healthy",
    tone: "success",
    tooltip: `Last successful probe ${formatTimestamp(lastSuccessfulProbeAt)} within the last 24 hours. Evidence source: ${source}.`
  };
}

/**
 * Catalog freshness is independent from reachability. A fresh catalog record
 * does not imply the resource is reachable, and vice versa.
 */
export function resolveCatalogFreshness(
  resource: Resource,
  now = Date.now()
): CatalogFreshnessEvidence {
  const availability = isRecord(resource.availability) ? resource.availability : undefined;
  const candidate =
    typeof availability?.catalogUpdatedAt === "string"
      ? availability.catalogUpdatedAt
      : resource.updatedAt;
  const parsed = parseEvidenceTimestamp(candidate);

  if (parsed === null || parsed > now + clockSkewToleranceMs) {
    return {
      catalogUpdatedAt: null,
      label: "Unknown",
      state: "unknown",
      tone: "warning",
      tooltip:
        "No reliable catalog update timestamp is available, so freshness cannot be confirmed."
    };
  }

  if (now - parsed > catalogStaleAfterMs) {
    return {
      catalogUpdatedAt: candidate,
      label: "Stale",
      state: "stale",
      tone: "warning",
      tooltip: `Last catalog update ${formatTimestamp(candidate)} is older than 7 days.`
    };
  }

  return {
    catalogUpdatedAt: candidate,
    label: "Fresh",
    state: "fresh",
    tone: "neutral",
    tooltip: `Catalog record last updated ${formatTimestamp(candidate)}.`
  };
}

export function resourceHealth(resource: Resource, now = Date.now()): ResourceHealth {
  return {
    availability: resolveAvailability(resource, now),
    freshness: resolveCatalogFreshness(resource, now)
  };
}

function normalizeTimestamp(value: unknown): string | null {
  return parseEvidenceTimestamp(value) === null ? null : (value as string);
}

function formatTimestamp(value: string | null) {
  if (value === null) return "unknown";

  return new Date(value).toLocaleString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
