import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { demoResources } from "@/fixtures/lumenbazaar";
import type { Resource } from "@/services/api/schemas";

import { SellerResourceList } from "./seller-resource-list";

const mocks = vi.hoisted(() => ({
  disable: vi.fn(),
  loadSnapshot: vi.fn(),
  restore: vi.fn()
}));

vi.mock("@/config/runtime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config/runtime")>();

  return {
    ...actual,
    loadRuntimeConfig: () => ({ ...actual.loadRuntimeConfig(), environment: "demo" as const })
  };
});

vi.mock("@/services/payments", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/payments")>();

  return { ...actual, loadSellerResourceSnapshot: mocks.loadSnapshot };
});

vi.mock("@/services/resource-lifecycle", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/resource-lifecycle")>();

  return {
    ...actual,
    resourceLifecycleCoordinator: {
      disable: mocks.disable,
      restore: mocks.restore
    }
  };
});

const active = demoResources[0]!;
const inactive = { ...active, status: "inactive" as const };

describe("SellerResourceList lifecycle actions", () => {
  beforeEach(() => {
    mocks.disable.mockReset();
    mocks.restore.mockReset();
    mocks.loadSnapshot.mockReset();
  });

  it("requires confirmation and a reason before disabling discovery", async () => {
    mocks.loadSnapshot.mockResolvedValue(snapshot([active]));
    const user = userEvent.setup();
    renderList();

    await user.click(await screen.findByRole("button", { name: /Disable Paid Weather API/i }));
    const confirmButton = screen.getByRole("button", { name: /Disable discovery/i });

    expect(confirmButton).toBeDisabled();
    await user.type(screen.getByLabelText("Reason"), "duplicate listing");
    expect(confirmButton).toBeDisabled();
    await user.click(screen.getByRole("checkbox"));
    expect(confirmButton).toBeEnabled();
    expect(mocks.disable).not.toHaveBeenCalled();
  });

  it("updates the list only after the accepted mutation result", async () => {
    mocks.loadSnapshot
      .mockResolvedValueOnce(snapshot([active]))
      .mockResolvedValue(snapshot([inactive]));
    mocks.disable.mockResolvedValue({ action: "disable", resource: inactive, source: "demo" });
    const user = userEvent.setup();
    renderList();

    expect(await screen.findByText("active")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Disable Paid Weather API/i }));
    await user.type(screen.getByLabelText("Reason"), "duplicate listing");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /Disable discovery/i }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Paid Weather API was removed from discovery"
    );
    await waitFor(() => expect(screen.getByText("inactive")).toBeInTheDocument());
    expect(mocks.disable).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmation: true,
        reason: "duplicate listing",
        resource: expect.objectContaining({ id: active.id, updatedAt: active.updatedAt })
      })
    );
  });

  it("shows a conflict and refreshes the stale list", async () => {
    const { ResourceLifecycleError } = await import("@/services/resource-lifecycle");
    mocks.loadSnapshot.mockResolvedValue(snapshot([active]));
    mocks.disable.mockRejectedValue(
      new ResourceLifecycleError({
        code: "RESOURCE_CONFLICT",
        message: "This resource changed since the list was loaded.",
        retryable: true
      })
    );
    const user = userEvent.setup();
    renderList();

    await user.click(await screen.findByRole("button", { name: /Disable Paid Weather API/i }));
    await user.type(screen.getByLabelText("Reason"), "stale screen");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /Disable discovery/i }));

    expect(await screen.findByRole("status")).toHaveTextContent("out of date");
    await waitFor(() => expect(mocks.loadSnapshot.mock.calls.length).toBeGreaterThan(1));
  });

  it("disables restore when the backend rejects eligibility", async () => {
    const { ResourceLifecycleError } = await import("@/services/resource-lifecycle");
    mocks.loadSnapshot.mockResolvedValue(snapshot([inactive]));
    mocks.restore.mockRejectedValue(
      new ResourceLifecycleError({
        code: "RESTORE_INELIGIBLE",
        message: "The backend does not consider this resource eligible for restore."
      })
    );
    const user = userEvent.setup();
    renderList();

    await user.click(await screen.findByRole("button", { name: /Restore Paid Weather API/i }));
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /Restore resource/i }));

    expect(await screen.findByText("RESTORE_INELIGIBLE")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Restore Paid Weather API/i })).toBeDisabled();
  });
});

function renderList() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  return render(<SellerResourceList sellerId="seller_atlas_weather" />, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
  });
}

function snapshot(resources: Resource[]) {
  return {
    fetchedAt: "2026-10-18T09:00:00.000Z",
    resources,
    source: "demo" as const
  };
}
