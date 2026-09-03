"use client";

import { Copy, Code2, AlertCircle } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import {
  buildExampleFromSchema,
  prettyJson,
  validateResourceSchemas
} from "@/components/resources/schema-utils";
import { type ResourceDraft } from "@/services/resource-creation";
import type { JsonObject } from "@/services/api/schemas";

type ResourceWizardMetadataProps = {
  draft: ResourceDraft;
  onUpdate: (updates: Partial<ResourceDraft>) => void;
  onNext: () => void;
  onPrev: () => void;
  isLoading?: boolean;
};

const DEFAULT_INPUT_SCHEMA: JsonObject = {
  type: "object",
  properties: {},
  required: []
};

const DEFAULT_OUTPUT_SCHEMA: JsonObject = {
  type: "object",
  properties: {},
  required: []
};

export function ResourceWizardMetadata({
  draft,
  onUpdate,
  onNext,
  onPrev,
  isLoading = false
}: ResourceWizardMetadataProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const inputSchema = draft.inputSchema || DEFAULT_INPUT_SCHEMA;
  const outputSchema = draft.outputSchema || DEFAULT_OUTPUT_SCHEMA;

  const validation = validateResourceSchemas(inputSchema, outputSchema);
  const inputExample = buildExampleFromSchema(inputSchema);
  const outputExample = buildExampleFromSchema(outputSchema);

  function handleInputSchemaChange(value: string) {
    try {
      const parsed = JSON.parse(value) as JsonObject;
      onUpdate({ inputSchema: parsed });
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.inputSchema;
        return newErrors;
      });
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        inputSchema: "Invalid JSON"
      }));
    }
  }

  function handleOutputSchemaChange(value: string) {
    try {
      const parsed = JSON.parse(value) as JsonObject;
      onUpdate({ outputSchema: parsed });
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.outputSchema;
        return newErrors;
      });
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        outputSchema: "Invalid JSON"
      }));
    }
  }

  function handleMcpMetadataChange(key: string, value: string) {
    const extensions = draft.extensions || {};
    const mcp = (extensions.mcp as Record<string, string>) || {};
    onUpdate({
      extensions: {
        ...extensions,
        mcp: {
          ...mcp,
          [key]: value
        }
      }
    });
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};

    if (!validation.inputValid) {
      newErrors.inputSchema = "Input schema must be a valid object schema";
    }

    if (!validation.outputValid) {
      newErrors.outputSchema = "Output schema must be a valid object schema";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleNext() {
    if (validateForm()) {
      onNext();
    }
  }

  const isMcpResource = draft.type === "mcp";
  const mcpMetadata = (draft.extensions?.mcp as Record<string, string>) || {};

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <div className="flex items-center gap-2">
              <Code2 aria-hidden="true" className="h-5 w-5 text-teal-700" />
              <h2 className="text-lg font-semibold text-slate-950">Resource schemas</h2>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Define the input and output schemas for requests and responses.
            </p>
          </div>
        </CardHeader>
        <CardBody className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Input Schema */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Input schema <span className="text-red-600">*</span>
              </label>
              <textarea
                value={prettyJson(inputSchema)}
                onChange={(e) => handleInputSchemaChange(e.target.value)}
                className={`min-h-64 w-full rounded-md border font-mono text-xs outline-none transition-colors ${
                  errors.inputSchema
                    ? "border-red-600 focus:ring-red-100"
                    : "border-slate-300 focus:ring-teal-100"
                } focus:border-teal-700 focus:ring-2 p-3`}
              />
              {errors.inputSchema ? (
                <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-600" aria-hidden="true" />
                  <p className="text-xs text-red-600">{errors.inputSchema}</p>
                </div>
              ) : null}
            </div>

            {/* Output Schema */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Output schema <span className="text-red-600">*</span>
              </label>
              <textarea
                value={prettyJson(outputSchema)}
                onChange={(e) => handleOutputSchemaChange(e.target.value)}
                className={`min-h-64 w-full rounded-md border font-mono text-xs outline-none transition-colors ${
                  errors.outputSchema
                    ? "border-red-600 focus:ring-red-100"
                    : "border-slate-300 focus:ring-teal-100"
                } focus:border-teal-700 focus:ring-2 p-3`}
              />
              {errors.outputSchema ? (
                <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-600" aria-hidden="true" />
                  <p className="text-xs text-red-600">{errors.outputSchema}</p>
                </div>
              ) : null}
            </div>
          </div>

          {/* Validation Status */}
          {validation.messages.length > 0 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-medium text-amber-900">Schema validation</p>
              {validation.messages.map((msg, idx) => (
                <p key={idx} className="text-xs text-amber-800">
                  • {msg}
                </p>
              ))}
            </div>
          ) : null}

          {/* Examples */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-700">Input example</p>
                <button
                  onClick={() => copyToClipboard(prettyJson(inputExample), "input")}
                  className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  type="button"
                  title="Copy to clipboard"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <pre className="overflow-auto rounded-md bg-slate-950 p-3 text-xs text-green-400">
                {prettyJson(inputExample)}
              </pre>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-700">Output example</p>
                <button
                  onClick={() => copyToClipboard(prettyJson(outputExample), "output")}
                  className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  type="button"
                  title="Copy to clipboard"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <pre className="overflow-auto rounded-md bg-slate-950 p-3 text-xs text-green-400">
                {prettyJson(outputExample)}
              </pre>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* MCP Metadata Section - only for MCP resources */}
      {isMcpResource && (
        <Card>
          <CardHeader>
            <div>
              <h2 className="text-lg font-semibold text-slate-950">MCP tool metadata</h2>
              <p className="mt-1 text-sm text-slate-600">
                Configure MCP-specific metadata for tool discovery and documentation.
              </p>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1">
                <span className="block text-sm font-medium text-slate-700">Server name</span>
                <input
                  type="text"
                  placeholder="e.g., lumen-rag-demo"
                  value={mcpMetadata.serverName || ""}
                  onChange={(e) => handleMcpMetadataChange("serverName", e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                />
                <p className="text-xs text-slate-500">Name of the MCP server</p>
              </label>

              <label className="space-y-1">
                <span className="block text-sm font-medium text-slate-700">Tool name</span>
                <input
                  type="text"
                  placeholder="e.g., search_stellar_docs"
                  value={mcpMetadata.toolName || ""}
                  onChange={(e) => handleMcpMetadataChange("toolName", e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                />
                <p className="text-xs text-slate-500">Name of the MCP tool</p>
              </label>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Navigation */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Schemas: {validation.inputValid && validation.outputValid ? (
              <Badge tone="success">Valid</Badge>
            ) : (
              <Badge tone="warning">Review required</Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={onPrev} variant="secondary" disabled={isLoading} type="button">
              ← Back
            </Button>
            <Button onClick={handleNext} disabled={isLoading} type="button">
              Continue to integration →
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
