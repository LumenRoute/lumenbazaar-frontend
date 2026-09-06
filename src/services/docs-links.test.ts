import { describe, expect, it } from "vitest";

import { canonicalDocsRepo, docsLinks } from "./docs-links";

describe("documentation links", () => {
  it("keeps frontend docs as links to the canonical docs repository", () => {
    expect(docsLinks).toHaveLength(7);
    expect(docsLinks.every((link) => link.href.startsWith(canonicalDocsRepo))).toBe(true);
  });
});
