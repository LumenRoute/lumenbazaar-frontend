import type { JsonObject, JsonValue } from "@/services/api/schemas";

export type SchemaValidationStatus = {
  inputValid: boolean;
  outputValid: boolean;
  messages: string[];
};

export function validateResourceSchemas(
  inputSchema: JsonObject,
  outputSchema: JsonObject
): SchemaValidationStatus {
  const messages: string[] = [];
  const inputValid = isObjectSchema(inputSchema);
  const outputValid = isObjectSchema(outputSchema);

  if (!inputValid) {
    messages.push("Input schema should describe an object.");
  }

  if (!outputValid) {
    messages.push("Output schema should describe an object.");
  }

  return {
    inputValid,
    messages,
    outputValid
  };
}

export function buildExampleFromSchema(schema: JsonObject): JsonObject {
  const properties = schema.properties;

  if (!isPlainObject(properties)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(properties).map(([key, value]) => [key, exampleForProperty(value)])
  );
}

export function prettyJson(value: JsonValue) {
  return JSON.stringify(value, null, 2);
}

function exampleForProperty(schema: JsonValue): JsonValue {
  if (!isPlainObject(schema)) {
    return null;
  }

  const examples = schema.examples;

  if (Array.isArray(examples) && examples.length > 0) {
    return (examples[0] ?? null) as JsonValue;
  }

  switch (schema.type) {
    case "array":
      return [];
    case "boolean":
      return true;
    case "integer":
    case "number":
      return 1;
    case "object":
      return {};
    case "string":
      return "example";
    default:
      return null;
  }
}

function isObjectSchema(schema: JsonObject) {
  return schema.type === "object" && isPlainObject(schema.properties);
}

function isPlainObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
