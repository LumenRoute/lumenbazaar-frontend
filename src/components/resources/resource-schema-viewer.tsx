"use client";

import { CheckCircle2, Clipboard, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { JsonObject } from "@/services/api/schemas";

import { buildExampleFromSchema, prettyJson, validateResourceSchemas } from "./schema-utils";

type ResourceSchemaViewerProps = {
  inputSchema: JsonObject;
  outputSchema: JsonObject;
};

export function ResourceSchemaViewer({ inputSchema, outputSchema }: ResourceSchemaViewerProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const status = validateResourceSchemas(inputSchema, outputSchema);
  const inputExample = buildExampleFromSchema(inputSchema);
  const outputExample = buildExampleFromSchema(outputSchema);

  async function copy(label: string, value: JsonObject) {
    await navigator.clipboard.writeText(prettyJson(value));
    setCopied(label);
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Schemas</h2>
          <p className="mt-1 text-sm text-slate-600">
            Input and output contracts for this resource.
          </p>
        </div>
        <Badge tone={status.messages.length === 0 ? "success" : "warning"}>
          {status.messages.length === 0 ? (
            <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
          ) : (
            <TriangleAlert aria-hidden="true" className="h-3.5 w-3.5" />
          )}
          {status.messages.length === 0 ? "Schema valid" : "Schema warning"}
        </Badge>
      </CardHeader>
      <CardBody className="space-y-4">
        {status.messages.length > 0 ? (
          <ul className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {status.messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        ) : null}
        <div className="grid gap-4 xl:grid-cols-2">
          <SchemaPanel
            copied={copied === "input"}
            example={inputExample}
            label="Input schema"
            onCopy={() => void copy("input", inputExample)}
            schema={inputSchema}
          />
          <SchemaPanel
            copied={copied === "output"}
            example={outputExample}
            label="Output schema"
            onCopy={() => void copy("output", outputExample)}
            schema={outputSchema}
          />
        </div>
      </CardBody>
    </Card>
  );
}

function SchemaPanel({
  copied,
  example,
  label,
  onCopy,
  schema
}: {
  copied: boolean;
  example: JsonObject;
  label: string;
  onCopy: () => void;
  schema: JsonObject;
}) {
  return (
    <section className="rounded-md border border-slate-200 bg-slate-950 text-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-700 px-4 py-3">
        <h3 className="text-sm font-semibold">{label}</h3>
        <Button
          aria-label={`Copy ${label} example`}
          className="border-slate-600 bg-slate-900 text-white hover:bg-slate-800"
          onClick={onCopy}
          type="button"
          variant="secondary"
        >
          <Clipboard aria-hidden="true" className="h-4 w-4" />
          {copied ? "Copied" : "Copy example"}
        </Button>
      </div>
      <div className="grid gap-0 lg:grid-cols-2">
        <pre className="max-h-96 overflow-auto border-b border-slate-800 p-4 text-xs leading-5 lg:border-b-0 lg:border-r">
          {prettyJson(schema)}
        </pre>
        <pre className="max-h-96 overflow-auto p-4 text-xs leading-5">{prettyJson(example)}</pre>
      </div>
    </section>
  );
}
