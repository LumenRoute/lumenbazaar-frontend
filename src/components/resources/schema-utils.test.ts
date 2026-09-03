import { describe, expect, it } from "vitest";

import { demoResources } from "@/fixtures/lumenbazaar";

import { buildExampleFromSchema, validateResourceSchemas } from "./schema-utils";

describe("schema viewer utilities", () => {
  it("builds deterministic examples from simple JSON schemas", () => {
    const example = buildExampleFromSchema(demoResources[0]!.inputSchema);

    expect(example).toEqual({
      city: "Lagos"
    });
  });

  it("reports schema validation status", () => {
    const status = validateResourceSchemas(
      demoResources[0]!.inputSchema,
      demoResources[0]!.outputSchema
    );

    expect(status.inputValid).toBe(true);
    expect(status.outputValid).toBe(true);
    expect(status.messages).toEqual([]);
  });
});
