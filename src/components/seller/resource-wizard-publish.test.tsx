import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildResourcePublishPayload,
  createEmptyDraft,
  type ResourceDraft
} from "@/services/resource-creation";

import { ResourceWizardPublish } from "./resource-wizard-publish";

const mocks = vi.hoisted(() => ({
  createResource: vi.fn(),
  validateResource: vi.fn()
}));

vi.mock("@/services/api/client", () => ({
  apiClient: {
    createResource: mocks.createResource,
    validateResource: mocks.validateResource
  }
}));

vi.mock("./seller-session-provider", () => ({
  useSellerSession: () => ({ canMutate: true })
}));

function completeDraft(): ResourceDraft {
  return {
    ...createEmptyDraft(),
    amount: "0.05",
    assetCode: "USDC",
    assetIssuer: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    description: "Weather data for a city",
    inputSchema: { properties: { city: { type: "string" } }, type: "object" },
    name: "Weather API",
    network: "stellar:testnet",
    outputSchema: { type: "object" },
    payTo: "GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE",
    routeTemplate: "/weather/{city}",
    url: "https://example.test/weather"
  };
}

beforeEach(() => {
  mocks.createResource.mockReset();
  mocks.validateResource.mockReset();
  mocks.createResource.mockResolvedValue({});
  mocks.validateResource.mockResolvedValue({ errors: [], valid: true, warnings: [] });
});

describe("ResourceWizardPublish preview", () => {
  it("renders the same normalized payload it validates and submits", async () => {
    const draft = completeDraft();
    const expected = buildResourcePublishPayload(draft, "seller_1");
    const user = userEvent.setup();

    render(<ResourceWizardPublish draft={draft} onPrev={vi.fn()} sellerId="seller_1" />);

    expect(await screen.findByText("Resource is valid and ready to publish")).toBeInTheDocument();
    expect(screen.getByText(expected.name)).toBeInTheDocument();
    expect(screen.getByText(expected.description)).toBeInTheDocument();
    expect(screen.getByText(expected.url)).toBeInTheDocument();
    expect(screen.getByText(/Not submitted: createdAt, updatedAt, status/)).toBeInTheDocument();
    expect(mocks.validateResource).toHaveBeenCalledWith(expected);

    await user.click(screen.getByRole("button", { name: "Publish resource" }));

    await waitFor(() => expect(mocks.createResource).toHaveBeenCalledWith(expected));
  });

  it("shows normalized defaults instead of blank preview values", async () => {
    const draft = {
      ...completeDraft(),
      amount: "",
      assetCode: "",
      assetIssuer: ""
    };

    render(<ResourceWizardPublish draft={draft} onPrev={vi.fn()} sellerId="seller_1" />);

    expect(await screen.findByText("USDC")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getAllByText("Not included").length).toBeGreaterThan(0);
  });
});
