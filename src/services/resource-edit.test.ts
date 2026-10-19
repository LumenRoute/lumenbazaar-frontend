import { beforeEach, describe, expect, it, vi } from "vitest";

import { demoResources } from "@/fixtures/lumenbazaar";

import {
  clearEditDraft,
  draftFromResource,
  loadEditDraft,
  loadResourceForEdit,
  resetDemoResourceEditStore,
  ResourceEditError,
  saveEditDraft,
  saveResourceEdit,
  unsupportedResourceEditPort,
  validateResourceEdit
} from "./resource-edit";

const base = demoResources[0]!;

describe("resource editing", () => {
  beforeEach(() => {
    resetDemoResourceEditStore();
    localStorage.clear();
  });

  it("loads the current version from the API before editing", async () => {
    const getResource = vi.fn(async () => base);
    const snapshot = await loadResourceForEdit(
      "resource_weather_lagos",
      { getResource },
      "testnet"
    );

    expect(getResource).toHaveBeenCalledWith("resource_weather_lagos");
    expect(snapshot).toMatchObject({
      source: "api",
      version: base.updatedAt
    });
    expect(snapshot.draft.name).toBe(base.name);
  });

  it("reports no changes for an untouched draft", () => {
    const validation = validateResourceEdit(base, draftFromResource(base));

    expect(validation.valid).toBe(true);
    expect(validation.diff.changed).toBe(false);
    expect(validation.diff.paymentCriticalChanges).toEqual([]);
  });

  it("flags payment-critical changes for prominent review", () => {
    const draft = {
      ...draftFromResource(base),
      amount: "0.9000000",
      payTo: "GDNQZCIXGRK7X5WJZVQVQGTU7BA3D47XAZ7VTTVXB5T5H2L5XRR7YDUA"
    };
    const validation = validateResourceEdit(base, draft);

    expect(validation.diff.paymentCriticalChanges.map((field) => field.field)).toEqual([
      "amount",
      "payTo"
    ]);
    expect(validation.diff.changed).toBe(true);
  });

  it("blocks invalid edits with field-level errors", () => {
    const validation = validateResourceEdit(base, {
      ...draftFromResource(base),
      amount: "",
      name: " "
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "name" }),
        expect.objectContaining({ field: "amount" })
      ])
    );
  });

  it("does not call the backend when nothing changed", async () => {
    const updateResource = vi.fn();
    const result = await saveResourceEdit({
      base,
      draft: draftFromResource(base),
      mode: "demo",
      port: { updateResource }
    });

    expect(result).toMatchObject({ changed: false, resource: base });
    expect(updateResource).not.toHaveBeenCalled();
  });

  it("publishes a new version from the loaded version", async () => {
    const draft = { ...draftFromResource(base), description: "Updated summary." };
    const result = await saveResourceEdit({ base, draft, mode: "demo" });

    expect(result.changed).toBe(true);
    expect(result.resource.description).toBe("Updated summary.");
    expect(result.resource.updatedAt).not.toBe(base.updatedAt);
  });

  it("preserves the draft and reports a conflict when a newer version exists", async () => {
    const firstDraft = { ...draftFromResource(base), description: "First edit." };
    const first = await saveResourceEdit({ base, draft: firstDraft, mode: "demo" });
    const staleDraft = { ...draftFromResource(base), description: "Stale edit." };
    saveEditDraft(base.id, staleDraft);

    await expect(saveResourceEdit({ base, draft: staleDraft, mode: "demo" })).rejects.toMatchObject(
      {
        code: "VERSION_CONFLICT",
        serverResource: { updatedAt: first.resource.updatedAt }
      }
    );

    expect(loadEditDraft(base.id)).toEqual(staleDraft);
  });

  it("requires an explicit overwrite to replace a newer server version", async () => {
    const first = await saveResourceEdit({
      base,
      draft: { ...draftFromResource(base), description: "Newer version." },
      mode: "demo"
    });
    const draft = { ...draftFromResource(base), description: "Confirmed overwrite." };

    const overwritten = await saveResourceEdit({
      base: first.resource,
      draft,
      mode: "demo",
      overwriteServerVersion: true
    });

    expect(overwritten.resource.description).toBe("Confirmed overwrite.");
  });

  it("fails closed when the backend has no update endpoint", async () => {
    await expect(
      unsupportedResourceEditPort.updateResource({
        draft: { ...draftFromResource(base), description: "Live edit." },
        expectedUpdatedAt: base.updatedAt,
        overwriteServerVersion: false,
        resourceId: base.id
      })
    ).rejects.toMatchObject({ code: "UNSUPPORTED_CAPABILITY" });
  });

  it("clears the preserved edit draft only after a successful publish", () => {
    saveEditDraft(base.id, draftFromResource(base));
    expect(loadEditDraft(base.id)).not.toBeNull();
    clearEditDraft(base.id);
    expect(loadEditDraft(base.id)).toBeNull();
  });

  it("keeps errors typed for the UI", () => {
    expect(
      new ResourceEditError({
        code: "VERSION_CONFLICT",
        message: "conflict"
      })
    ).toBeInstanceOf(Error);
  });
});
