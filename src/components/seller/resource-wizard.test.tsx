import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { demoResources } from "@/fixtures/lumenbazaar";
import { draftFromResource } from "@/services/resource-edit";

import { ResourceWizard } from "./resource-wizard";

const mocks = vi.hoisted(() => ({ loadResourceForEdit: vi.fn() }));

vi.mock("@/services/resource-edit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/resource-edit")>();

  return { ...actual, loadResourceForEdit: mocks.loadResourceForEdit };
});

const base = demoResources[0]!;

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
