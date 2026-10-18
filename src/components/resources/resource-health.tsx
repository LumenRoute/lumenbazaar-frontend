import { Activity, Clock3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { Resource } from "@/services/api/schemas";
import { resourceHealth } from "@/services/resource-health";

export function ResourceHealthBadges({ now, resource }: { now?: number; resource: Resource }) {
  const { availability, freshness } = resourceHealth(resource, now);

  return (
    <div className="flex flex-wrap gap-2">
      <span title={availability.tooltip}>
        <Badge tone={availability.tone}>
          <Activity aria-hidden="true" className="h-3.5 w-3.5" />
          Availability: {availability.label}
        </Badge>
      </span>
      <span title={freshness.tooltip}>
        <Badge tone={freshness.tone}>
          <Clock3 aria-hidden="true" className="h-3.5 w-3.5" />
          Catalog: {freshness.label}
        </Badge>
      </span>
    </div>
  );
}

export function ResourceHealthPanel({ now, resource }: { now?: number; resource: Resource }) {
  const { availability, freshness } = resourceHealth(resource, now);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <ResourceHealthBadges now={now} resource={resource} />
      </div>
      <dl className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
        <EvidenceField
          label="Availability evidence"
          value={availability.source}
          tooltip={availability.tooltip}
        />
        <EvidenceField
          label="Last probe"
          value={formatEvidenceTime(availability.lastProbeAt)}
          tooltip="Timestamp of the most recent backend probe attempt."
        />
        <EvidenceField
          label="Last successful probe"
          value={formatEvidenceTime(availability.lastSuccessfulProbeAt)}
          tooltip="Timestamp of the most recent successful backend probe. Probes older than 24 hours are treated as stale."
        />
        <EvidenceField
          label="Catalog updated"
          value={formatEvidenceTime(freshness.catalogUpdatedAt)}
          tooltip="Timestamp of the last catalog record update. Freshness is shown independently from reachability."
        />
      </dl>
      <p className="text-xs leading-5 text-slate-500">
        Availability and catalog freshness come from backend evidence. Missing or old probes are
        shown as unknown or stale and never as healthy.
      </p>
    </div>
  );
}

function EvidenceField({
  label,
  tooltip,
  value
}: {
  label: string;
  tooltip: string;
  value: string;
}) {
  return (
    <div className="min-w-0" title={tooltip}>
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-1 break-words font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function formatEvidenceTime(value: string | null) {
  if (value === null) return "Unknown";

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toLocaleString() : "Unknown";
}
