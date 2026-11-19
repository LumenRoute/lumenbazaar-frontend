"use client";

import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { type JsonObject } from "@/services/api/schemas";
import { findMcpTool, type McpToolName } from "@/services/mcp-tools";
import { isSensitivePaymentKey, redactSensitivePaymentData } from "@/services/ui-state";

export type McpToolPreviewProps = {
  /** The name of the MCP tool being invoked */
  toolName: McpToolName;
  /** The arguments to be passed to the tool */
  arguments: JsonObject;
  /** Optional payment payload for paid resources */
  paymentPayload?: JsonObject;
  /** Optional maximum spending limit */
  maxAmount?: string;
  /** Callback when user confirms the invocation */
  onConfirm: () => void;
  /** Callback when user cancels the invocation */
  onCancel: () => void;
  /** Whether the preview is in a loading state */
  isLoading?: boolean;
};

/**
 * McpToolPreview component renders a schema-aware preview of MCP tool invocation
 * with sensitive field masking and explicit confirmation for consequential tools.
 *
 * Features:
 * - Displays tool metadata and budget information
 * - Shows tool arguments with sensitive fields masked
 * - Renders payment payload information with redacted sensitive data
 * - Provides clear confirm/cancel actions
 * - Responsive design for desktop and mobile
 */
export function McpToolPreview({
  toolName,
  arguments: toolArguments,
  paymentPayload,
  maxAmount,
  onConfirm,
  onCancel,
  isLoading = false
}: McpToolPreviewProps) {
  const tool = useMemo(() => findMcpTool(toolName), [toolName]);

  if (!tool) {
    return (
      <Card>
        <CardBody className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600" aria-hidden="true" />
          <div>
            <p className="font-medium text-slate-950">Tool not found</p>
            <p className="text-sm text-slate-600">The MCP tool "{toolName}" is not available.</p>
          </div>
        </CardBody>
      </Card>
    );
  }

  const hasSensitiveData = containsSensitiveData(toolArguments);
  const redactedPayload = paymentPayload ? redactSensitivePaymentData(paymentPayload) : null;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950">
            {hasSensitiveData ? (
              <AlertCircle className="h-5 w-5 text-amber-600" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden="true" />
            )}
            Tool invocation preview
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Review the tool arguments before invoking. Sensitive fields are masked.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasSensitiveData && (
            <Badge tone="warning">Sensitive data</Badge>
          )}
          <Badge tone="info">{tool.budget.settlementMode}</Badge>
        </div>
      </CardHeader>
      <CardBody className="space-y-6">
        {/* Tool Information */}
        <div className="space-y-3">
          <h3 className="font-medium text-slate-950">Tool</h3>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            <InfoBlock label="Name" value={tool.name} />
            <InfoBlock
              label="Max calls"
              value={`${tool.budget.maxCalls} call${tool.budget.maxCalls !== 1 ? "s" : ""}`}
            />
            <InfoBlock label="Settlement" value={tool.budget.settlementMode} />
          </div>
          <p className="text-sm leading-6 text-slate-600">{tool.description}</p>
        </div>

        {/* Budget Controls */}
        <div className="space-y-3">
          <h3 className="font-medium text-slate-950">Budget controls</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoBlock label="Default limit" value={tool.budget.defaultMaxAmount} />
            {maxAmount && <InfoBlock label="Override limit" value={maxAmount} />}
          </div>
        </div>

        {/* Tool Arguments */}
        <div className="space-y-3">
          <h3 className="font-medium text-slate-950">Tool arguments</h3>
          <ArgumentsPreview
            schema={tool.inputSchema}
            arguments={toolArguments}
            hasSensitiveData={hasSensitiveData}
          />
        </div>

        {/* Payment Payload */}
        {redactedPayload && (
          <div className="space-y-3">
            <h3 className="font-medium text-slate-950">Payment authorization</h3>
            <PayloadPreview payload={redactedPayload} />
          </div>
        )}

        {/* Deterministic Errors */}
        {tool.deterministicErrors.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-medium text-slate-950">Expected errors</h3>
            <div className="space-y-2">
              {tool.deterministicErrors.map((error) => (
                <div
                  key={error.code}
                  className="rounded-md border border-slate-200 bg-slate-50 p-3"
                >
                  <Badge tone={error.code.includes("FAILED") ? "danger" : "warning"}>
                    {error.code}
                  </Badge>
                  <p className="mt-2 text-sm text-slate-600">{error.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Confirmation */}
        <div className="flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row-reverse sm:justify-start">
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            variant="primary"
            className="justify-center"
          >
            {isLoading ? "Invoking..." : "Confirm invocation"}
          </Button>
          <Button
            onClick={onCancel}
            disabled={isLoading}
            variant="secondary"
            className="justify-center"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Cancel
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-1 break-all text-sm font-medium text-slate-950">{value}</p>
    </div>
  );
}

interface ArgumentsPreviewProps {
  schema: JsonObject;
  arguments: JsonObject;
  hasSensitiveData: boolean;
}

function ArgumentsPreview({ schema, arguments: args, hasSensitiveData }: ArgumentsPreviewProps) {
  const schemaProperties = (schema?.properties as Record<string, unknown>) ?? {};
  const requiredFields = (schema?.required as string[]) ?? [];

  return (
    <div className="space-y-2">
      {Object.entries(args).map(([key, value]) => {
        const isRequired = requiredFields.includes(key);
        const isSensitive = isSensitivePaymentKey(key);
        const displayValue = isSensitive ? "[redacted]" : JSON.stringify(value);

        return (
          <div key={key} className="rounded-md border border-slate-200 bg-white p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-medium text-slate-950">{key}</span>
              {isRequired && <Badge tone="info">required</Badge>}
              {isSensitive && <Badge tone="warning">sensitive</Badge>}
            </div>
            <pre className="max-h-40 overflow-auto rounded bg-slate-950 px-3 py-2 text-xs text-slate-100">
              <code>{displayValue}</code>
            </pre>
          </div>
        );
      })}
      {Object.keys(args).length === 0 && (
        <p className="text-sm text-slate-600">No arguments provided.</p>
      )}
    </div>
  );
}

interface PayloadPreviewProps {
  payload: unknown;
}

function PayloadPreview({ payload }: PayloadPreviewProps) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-950">Redacted payment data</p>
        <Badge tone="warning">sensitive fields masked</Badge>
      </div>
      <pre className="max-h-64 overflow-auto rounded-md bg-slate-950 p-4 text-xs text-slate-100">
        <code>{JSON.stringify(payload, null, 2)}</code>
      </pre>
    </div>
  );
}

/**
 * Checks if the provided arguments contain any sensitive data
 */
function containsSensitiveData(obj: unknown): boolean {
  if (Array.isArray(obj)) {
    return obj.some((item) => containsSensitiveData(item));
  }

  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  return Object.keys(obj).some(
    (key) => isSensitivePaymentKey(key) || containsSensitiveData((obj as Record<string, unknown>)[key])
  );
}
