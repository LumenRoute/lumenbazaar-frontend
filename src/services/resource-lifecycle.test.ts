import { beforeEach, describe, expect, it, vi } from "vitest";

import { demoResources } from "@/fixtures/lumenbazaar";
import type { Resource } from "@/services/api/schemas";

import {
  createResourceLifecycleCoordinator,
  demoResourceLifecyclePort,
  resetDemoResourceLifecycle,
  seedDemoResourceLifecycle,
  unsupportedResourceLifecyclePort,
  type ResourceLifecyclePort
} from "./resource-lifecycle";

const activeResource = demoResources[0]!;
const draftResource = {
  ...activeResource,
  id: "resource_draft",
  status: "draft" as const
};

function coordinator() {
  return createResourceLifecycleCoordinator({ mode: () => "demo" });
}

describe("resource lifecycle", () => {
  beforeEach(() => {
    resetDemoResourceLifecycle();
    seedDemoResourceLifecycle([activeResource, draftResource]);
  });

  it("requires explicit confirmation and a reason for disable", async () => {
    await expect(
      coordinator().disable({ confirmation: false, reason: "duplicate", resource: activeResource })
    ).rejects.toMatchObject({ code: "CONFIRMATION_REQUIRED" });

    await expect(
      coordinator().disable({ confirmation: true, reason: "   ", resource: activeResource })
    ).rejects.toMatchObject({ code: "REASON_REQUIRED" });

    await expect(
      coordinator().disable({
        confirmation: true,
        reason: "duplicate listing",
        resource: { ...activeResource, updatedAt: "" }
      })
    ).rejects.toMatchObject({ code: "RESOURCE_VERSION_REQUIRED" });
  });

  it("disables discovery only for the current version", async () => {
    const result = await coordinator().disable({
      confirmation: true,
      reason: "duplicate listing",
      resource: activeResource
    });

    expect(result).toMatchObject({
      action: "disable",
      resource: { status: "inactive" },
      source: "demo"
    });
    expect(result.resource.updatedAt).not.toBe(activeResource.updatedAt);
  });

  it("rejects stale versions with a conflict instead of overwriting a newer resource", async () => {
    await coordinator().disable({
      confirmation: true,
      reason: "first change",
      resource: activeResource
    });

    await expect(
      coordinator().disable({
        confirmation: true,
        reason: "stale screen",
        resource: activeResource
      })
    ).rejects.toMatchObject({ code: "RESOURCE_CONFLICT", retryable: true });
  });

  it("restores an eligible inactive version after disable", async () => {
    const disabled = await coordinator().disable({
      confirmation: true,
      reason: "temporary",
      resource: activeResource
    });
    const restored = await coordinator().restore({
      confirmation: true,
      reason: "restore",
      resource: disabled.resource
    });

    expect(restored).toMatchObject({ action: "restore", resource: { status: "active" } });
  });

  it("marks restore ineligible when the backend rejects eligibility", async () => {
    const inactiveDraft: Resource = { ...draftResource, status: "inactive" };
    seedDemoResourceLifecycle([inactiveDraft]);

    await expect(
      coordinator().restore({
        confirmation: true,
        reason: "restore",
        resource: inactiveDraft
      })
    ).rejects.toMatchObject({ code: "RESTORE_INELIGIBLE" });
  });

  it("coalesces duplicate actions into one backend mutation", async () => {
    let resolve: ((resource: Resource) => void) | undefined;
    const disableResource = vi.fn(
      () =>
        new Promise<Resource>((resolveMutation) => {
          resolve = resolveMutation;
        })
    );
    const port: ResourceLifecyclePort = {
      disableResource,
      restoreResource: vi.fn()
    };
    const coordinatorInstance = createResourceLifecycleCoordinator({ mode: () => "demo" });
    const input = {
      confirmation: true,
      port,
      reason: "duplicate clicks",
      resource: activeResource
    };

    const first = coordinatorInstance.disable(input);
    const second = coordinatorInstance.disable(input);

    expect(first).toBe(second);
    expect(disableResource).toHaveBeenCalledTimes(1);
    resolve?.(activeResource);
    await expect(first).resolves.toMatchObject({ action: "disable" });
  });

  it("keeps the UI state authoritative when the backend is unavailable", async () => {
    const port: ResourceLifecyclePort = {
      disableResource: async () => Promise.reject(new Error("network unavailable")),
      restoreResource: async () => Promise.reject(new Error("network unavailable"))
    };

    await expect(
      coordinator().disable({
        confirmation: true,
        port,
        reason: "outage",
        resource: activeResource
      })
    ).rejects.toMatchObject({ code: "BACKEND_UNAVAILABLE", retryable: true });
  });

  it("fails closed when the pinned backend has no lifecycle endpoints", async () => {
    await expect(
      unsupportedResourceLifecyclePort.disableResource({
        expectedUpdatedAt: activeResource.updatedAt,
        reason: "unsupported",
        resourceId: activeResource.id
      })
    ).rejects.toMatchObject({ code: "UNSUPPORTED_CAPABILITY" });
  });

  it("never revokes payment authorizations as a side effect of disable", async () => {
    const disabled = await demoResourceLifecyclePort.disableResource({
      expectedUpdatedAt: activeResource.updatedAt,
      reason: "discovery only",
      resourceId: activeResource.id
    });

    // Lifecycle changes only touch discovery metadata; payment terms and payTo
    // remain unchanged so issued authorizations are unaffected.
    expect(disabled.payTo).toBe(activeResource.payTo);
    expect(disabled.amount).toBe(activeResource.amount);
    expect(disabled.assetIssuer).toBe(activeResource.assetIssuer);
  });
});
