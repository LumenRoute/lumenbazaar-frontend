import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { demoResources } from "@/fixtures/lumenbazaar";
import { draftFromResource } from "@/services/resource-edit";

import { ResourceEditReview } from "./resource-edit-review";

const mocks = vi.hoisted(() => ({ saveResourceEdit: vi.fn() }));

vi.mock("@/services/resource-edit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/resource-edit")>();

  return { ...actual, saveResourceEdit: mocks.saveResourceEdit };
});

const base = demoResources[0]!;

describe("ResourceEditReview", () => {
  it("prominently reviews payment-critical changes", () => {
    const draft = { ...draftFromResource(base), amount: "0.9000000" };
    renderReview(draft);

    expect(screen.getByText("Payment-critical changes")).toBeInTheDocument();
    expect(screen.getAllByText("Amount").length).toBeGreaterThan(0);
    expect(screen.getAllByText("0.9000000").length).toBeGreaterThan(0);
  });

  it("requires explicit review confirmation before publishing", async () => {
    const user = userEvent.setup();
    renderReview({ ...draftFromResource(base), description: "Changed." });

    const publish = screen.getByRole("button", { name: /Publish new version/i });
    expect(publish).toBeDisabled();
    await user.click(screen.getByLabelText(/I reviewed the endpoint/));
    expect(publish).toBeEnabled();
    expect(mocks.saveResourceEdit).not.toHaveBeenCalled();
  });

  it("preserves the draft and requires an explicit overwrite on a version conflict", async () => {
    const { ResourceEditError } = await import("@/services/resource-edit");
    const newer = { ...base, updatedAt: "2026-10-18T12:00:00.000Z" };
    mocks.saveResourceEdit
      .mockRejectedValueOnce(
        new ResourceEditError({
          code: "VERSION_CONFLICT",
          message: "A newer version exists.",
          serverResource: newer
        })
      )
      .mockResolvedValueOnce({ changed: true, resource: newer, source: "demo" });
    const user = userEvent.setup();
    const onSaved = vi.fn();
    renderReview({ ...draftFromResource(base), description: "Local draft." }, onSaved);

    await user.click(screen.getByLabelText(/I reviewed the endpoint/));
    await user.click(screen.getByRole("button", { name: /Publish new version/i }));

    expect(await screen.findByText("Version conflict")).toBeInTheDocument();
    const overwrite = screen.getByRole("button", { name: /Overwrite newer version/i });
    expect(overwrite).toBeDisabled();

    await user.click(screen.getByLabelText(/replaces the newer server version/i));
    expect(overwrite).toBeEnabled();
    await user.click(overwrite);

    await waitFor(() =>
      expect(mocks.saveResourceEdit).toHaveBeenLastCalledWith(
        expect.objectContaining({ overwriteServerVersion: true })
      )
    );
    expect(onSaved).toHaveBeenCalledWith(newer);
  });

  it("reports unchanged drafts without publishing", async () => {    mocks.saveResourceEdit.mockResolvedValueOnce({ changed: false, resource: base, source: "demo" });
    renderReview(draftFromResource(base));

    expect(screen.getByText(/draft matches the current version/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Publish new version/i })).toBeDisabled();
  });
});

function renderReview(draft: ReturnType<typeof draftFromResource>, onSaved = vi.fn()) {
  return render(
    <ResourceEditReview
      base={base}
      draft={draft}
      onBack={vi.fn()}
      onReplaceVersion={vi.fn()}
      onSaved={onSaved}
    />
  );
}
