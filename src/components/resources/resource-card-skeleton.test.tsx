import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ResourceCardSkeletonList } from "./resource-card-skeleton";

describe("ResourceCardSkeletonList", () => {
  it("renders deterministic cards without announcing a result count", () => {
    const { container } = render(<ResourceCardSkeletonList count={3} />);

    const status = screen.getByRole("status", { name: "Loading catalog results" });
    expect(status).toHaveTextContent("Loading resources");
    expect(status).not.toHaveTextContent(/\d+ resources/);
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(3);
  });

  it("keeps compact geometry readable", () => {
    render(<ResourceCardSkeletonList count={1} density="compact" />);

    expect(screen.getByRole("status", { name: "Loading catalog results" })).toBeVisible();
  });
});
