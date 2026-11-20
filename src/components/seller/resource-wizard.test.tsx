import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { demoResources } from "@/fixtures/lumenbazaar";
import {
  createEmptyDraft,
  loadDraftFromStorage,
  saveDraftToStorage
} from "@/services/resource-creation";
import { draftFromResource } from "@/services/resource-edit";

import { ResourceWizard } from "./resource-wizard";

const mocks = vi.hoisted(() => ({ loadResourceForEdit: vi.fn() }));

vi.mock("@/hooks/motion-context", () => ({
  useMotion: () => ({ enableMotion: false })
}));

vi.mock("@/services/resource-edit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/resource-edit")>();

  return { ...actual, loadResourceForEdit: mocks.loadResourceForEdit };
});

const base = demoResources[0]!;

describe("ResourceWizard unsaved-change protection", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("leaves an untouched form without a warning", async () => {
    const onCancel = vi.fn();
    const confirm = vi.spyOn(window, "confirm");
    const user = userEvent.setup();

    render(<ResourceWizard onCancel={onCancel} sellerId="seller_atlas_weather" />);

    await user.click(await screen.findByRole("button", { name: "Save and exit" }));

    expect(confirm).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });

  it("confirms before abandoning meaningful edits and respects dismissal", async () => {
    const onCancel = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();

    render(<ResourceWizard onCancel={onCancel} sellerId="seller_atlas_weather" />);

    const name = await screen.findByPlaceholderText("e.g., Paid Weather API");
    await user.type(name, "Weather API");
    await user.click(screen.getByRole("button", { name: "Save and exit" }));

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: "Save and exit" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("offers explicit recovery with age and schema version", async () => {
    saveDraftToStorage({ ...createEmptyDraft(), name: "Recovered API" });
    const user = userEvent.setup();

    render(<ResourceWizard onCancel={vi.fn()} sellerId="seller_atlas_weather" />);

    expect(await screen.findByText(/Recovered an autosaved draft/)).toBeInTheDocument();
    expect(screen.getByText(/less than a minute/)).toBeInTheDocument();
    expect(screen.getByText(/schema v1/)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Recovered API")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Discard recovered draft" }));

    expect(loadDraftFromStorage()).toBeNull();
    expect(screen.queryByText(/Recovered an autosaved draft/)).not.toBeInTheDocument();
    expect(screen.getByText(/Draft discarded/)).toBeInTheDocument();
  });

  it("clears dirty state after discarding the draft", async () => {
    const user = userEvent.setup();

    render(<ResourceWizard onCancel={vi.fn()} sellerId="seller_atlas_weather" />);

    const name = await screen.findByPlaceholderText("e.g., Paid Weather API");
    await user.type(name, "Weather API");

    const discard = screen.getByRole("button", { name: "Discard draft" });
    expect(discard).toBeEnabled();

    await user.click(discard);

    expect(screen.getByText(/Draft discarded/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Discard draft" })).toBeDisabled();
    expect(screen.queryByText(/Unsaved changes/)).not.toBeInTheDocument();
  });
});

describe("ResourceWizard edit mode", () => {
  beforeEach(() => {
    mocks.loadResourceForEdit.mockReset();
    localStorage.clear();
  });

  it("loads the current version from the API and shows the review step", async () => {
    mocks.loadResourceForEdit.mockResolvedValue({
      base,
      draft: draftFromResource(base),
      source: "api",
      version: base.updatedAt
    });
    const user = userEvent.setup();

    render(<ResourceWizard onCancel={vi.fn()} resourceId={base.id} sellerId={base.sellerId} />);

    expect(await screen.findByDisplayValue(base.name)).toBeInTheDocument();
    expect(mocks.loadResourceForEdit).toHaveBeenCalledWith(base.id);
    expect(screen.getByRole("button", { name: /Review changes/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Publish/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Review changes/ }));

    expect(screen.getByText("Review version changes")).toBeInTheDocument();
    expect(screen.getByText(/draft matches the current version/i)).toBeInTheDocument();
  });

  it("prefers a preserved local draft over the server version", async () => {
    const preserved = { ...draftFromResource(base), description: "Preserved local draft." };
    localStorage.setItem(`lumenbazaar_resource_edit_draft:${base.id}`, JSON.stringify(preserved));
    mocks.loadResourceForEdit.mockResolvedValue({
      base,
      draft: draftFromResource(base),
      source: "api",
      version: base.updatedAt
    });

    render(<ResourceWizard onCancel={vi.fn()} resourceId={base.id} sellerId={base.sellerId} />);

    expect(await screen.findByDisplayValue("Preserved local draft.")).toBeInTheDocument();
  });

  it("reports a load failure instead of rendering an empty wizard", async () => {
    mocks.loadResourceForEdit.mockRejectedValue(new Error("Resource unavailable."));

    render(<ResourceWizard onCancel={vi.fn()} resourceId="resource_missing" sellerId="s" />);

    expect(await screen.findByText("Resource unavailable")).toBeInTheDocument();
    expect(screen.getAllByText(/Resource unavailable/).length).toBeGreaterThan(1);
  });
});
