import { describe, expect, it } from "vitest";

import { findMcpTool, mcpToolContracts, toolBudgetCeiling } from "./mcp-tools";

describe("MCP tool contracts", () => {
  it("defines the expected paid-resource tools", () => {
    expect(mcpToolContracts.map((tool) => tool.name)).toEqual([
      "search_paid_resources",
      "inspect_resource",
      "call_paid_resource"
    ]);
  });

  it("keeps deterministic error examples attached to every tool", () => {
    expect(mcpToolContracts.every((tool) => tool.deterministicErrors.length > 0)).toBe(true);
    expect(
      findMcpTool("call_paid_resource")?.deterministicErrors.map((error) => error.code)
    ).toContain("SETTLEMENT_FAILED");
  });

  it("calculates the default budget ceiling", () => {
    expect(toolBudgetCeiling()).toBe(1.5);
  });
});
