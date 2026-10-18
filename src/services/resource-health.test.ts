import { describe, expect, it } from "vitest";

import { demoResources } from "@/fixtures/lumenbazaar";
import type { Resource } from "@/services/api/schemas";

import { resolveAvailability, resolveCatalogFreshness } from "./resource-health";

const now = Date.parse("2026-10-18T12:00:00.000Z");
const base = demoResources[0]!;

function resourceWith(availability: Resource["availability"]): Resource {
  return {
    ...base,
    availability
  };
}

describe("resource availability", () => {
  it("reports a recent successful probe as healthy", () => {
    const evidence = resolveAvailability(
      resourceWith({
        catalogUpdatedAt: "2026-10-18T10:00:00.000Z",
        lastProbeAt: "2026-10-18T11:30:00.000Z",
        lastSuccessfulProbeAt: "2026-10-18T11:30:00.000Z",
        source: "catalog-prober",
        status: "healthy"
      }),
      now
    );

    expect(evidence.state).toBe("healthy");
    expect(evidence.label).toBe("Healthy");
    expect(evidence.tone).toBe("success");
    expect(evidence.tooltip).toContain("catalog-prober");
  });

  it("keeps degraded distinct from unavailable", () => {
    const evidence = resolveAvailability(
      resourceWith({
        lastProbeAt: "2026-10-18T11:30:00.000Z",
        lastSuccessfulProbeAt: "2026-10-18T11:30:00.000Z",
        status: "degraded"
      }),
      now
    );

    expect(evidence.state).toBe("degraded");
    expect(evidence.label).toBe("Degraded");
    expect(evidence.tone).toBe("warning");
  });

  it("never presents an old probe as healthy", () => {
    const evidence = resolveAvailability(
      resourceWith({
        lastSuccessfulProbeAt: "2026-10-16T11:00:00.000Z",
        status: "healthy"
      }),
      now
    );

    expect(evidence.state).toBe("stale");
    expect(evidence.label).toBe("Stale probe");
    expect(evidence.tone).toBe("warning");
  });

  it("never presents a healthy state without a successful probe timestamp", () => {
    const evidence = resolveAvailability(resourceWith({ status: "healthy" }), now);

    expect(evidence.state).toBe("unknown");
    expect(evidence.label).toBe("Unverified");
    expect(evidence.tone).toBe("warning");
  });

  it("reports missing evidence as unknown", () => {
    const evidence = resolveAvailability(resourceWith(undefined), now);

    expect(evidence.state).toBe("unknown");
    expect(evidence.label).toBe("Unknown");
    expect(evidence.tone).toBe("neutral");
  });

  it("fails closed on malformed status and timestamps", () => {
    const malformedStatus = resolveAvailability(
      resourceWith({ status: "great" as never, lastSuccessfulProbeAt: "not-a-date" }),
      now
    );
    const futureProbe = resolveAvailability(
      resourceWith({
        lastSuccessfulProbeAt: "2027-01-01T00:00:00.000Z",
        status: "healthy"
      }),
      now
    );

    expect(malformedStatus.state).toBe("unknown");
    expect(malformedStatus.tone).toBe("warning");
    expect(malformedStatus.lastSuccessfulProbeAt).toBeNull();
    expect(futureProbe.state).toBe("unknown");
    expect(futureProbe.label).toBe("Unknown");
  });

  it("marks an unavailable resource without inferring health from catalog freshness", () => {
    const resource = resourceWith({
      lastSuccessfulProbeAt: "2026-10-18T11:30:00.000Z",
      status: "unavailable"
    });
    const availability = resolveAvailability(resource, now);
    const freshness = resolveCatalogFreshness(resource, now);

    expect(availability.state).toBe("unavailable");
    expect(availability.tone).toBe("danger");
    expect(freshness.state).toBe("stale");
  });
});

describe("catalog freshness", () => {
  it("tracks catalog freshness independently from availability", () => {
    const resource = resourceWith({
      catalogUpdatedAt: "2026-10-18T11:00:00.000Z",
      lastSuccessfulProbeAt: "2026-10-16T11:00:00.000Z",
      status: "healthy"
    });

    expect(resolveAvailability(resource, now).state).toBe("stale");
    expect(resolveCatalogFreshness(resource, now).state).toBe("fresh");
  });

  it("reports stale and unknown catalog timestamps", () => {
    expect(
      resolveCatalogFreshness(
        resourceWith({
          catalogUpdatedAt: "2026-10-01T10:00:00.000Z",
          status: "healthy"
        }),
        now
      ).state
    ).toBe("stale");

    expect(
      resolveCatalogFreshness(
        { ...base, availability: undefined, updatedAt: "garbage" } as Resource,
        now
      ).state
    ).toBe("unknown");
  });
});
