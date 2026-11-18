"use client";

import { ChevronDown, Copy, AlertCircle } from "lucide-react";
import { useCallback, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import {
  estimateResponseSize,
  formatResponseForCopy,
  formatResponseForDisplay,
  truncateForPreview,
  validateResponseStructure,
  type RedactionConfig
} from "@/lib/export-utils";

export type McpResponseViewerProps = {
  /** The response data to display */
  response: unknown;
  /** Optional title for the response section */
  title?: string;
  /** Optional description */
  description?: string;
  /** Whether to redact sensitive data */
  redact?: boolean;
  /** Additional keys to redact beyond defaults */
  additionalRedactionKeys?: string[];
  /** Maximum size for display in bytes */
  maxSize?: number;
};

/**
 * Component for displaying MCP responses with redaction, size limits, and safe copy controls.
 * Handles large responses by truncating for display, validates malformed data, and provides
 * structured expandable rendering.
 */
export function McpResponseViewer({
  response,
  title = "Response",
  description,
  redact = true,
  additionalRedactionKeys = [],
  maxSize = 1024 * 1024
}: McpResponseViewerProps) {
  const [expanded, setExpanded] = useState(false);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);

  // Validate response structure
  const validation = validateResponseStructure(response);
  const sizeInfo = estimateResponseSize(response);

  // Build redaction config
  const redactionConfig: RedactionConfig = {
    redact,
    additionalRedactionKeys,
    maxSize
  };

  // Get display content
  const displayContent = formatResponseForDisplay(response, redactionConfig);
  const previewContent = truncateForPreview(displayContent);

  // Handle copy to clipboard
  const handleCopy = useCallback(async () => {
    try {
      const { content, truncated, reason } = formatResponseForCopy(response, redactionConfig);
      await navigator.clipboard.writeText(content);
      setCopiedToClipboard(true);

      // Show notification if truncated
      if (truncated && reason) {
        console.warn("Response truncated for copy:", reason);
      }

      // Reset copied state after 2 seconds
      setTimeout(() => setCopiedToClipboard(false), 2000);
    } catch (error) {
      console.error("Failed to copy response:", error);
    }
  }, [response, redactionConfig]);

  // Render error state for malformed responses
  if (!validation.valid) {
    return (
      <Card>
        <CardHeader>
          <h3 className="flex items-center gap-2 text-base font-semibold text-red-900">
            <AlertCircle aria-hidden="true" className="h-5 w-5 text-red-600" />
            {title}
          </h3>
        </CardHeader>
        <CardBody className="space-y-3">
          {description && <p className="text-sm text-slate-600">{description}</p>}
          <div className="rounded-md border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-900">Malformed response detected</p>
            <ul className="mt-2 space-y-1">
              {validation.errors.map((error, index) => (
                <li key={index} className="text-xs text-red-800">
                  • {error}
                </li>
              ))}
            </ul>
          </div>
        </CardBody>
      </Card>
    );
  }

  // Render warning state for very large responses
  if (sizeInfo.category === "huge") {
    return (
      <Card>
        <CardHeader>
          <h3 className="flex items-center gap-2 text-base font-semibold text-amber-900">
            <AlertCircle aria-hidden="true" className="h-5 w-5 text-amber-600" />
            {title}
          </h3>
        </CardHeader>
        <CardBody className="space-y-3">
          {description && <p className="text-sm text-slate-600">{description}</p>}
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-900">Response too large to display</p>
            <p className="mt-1 text-xs text-amber-800">
              Response size: {(sizeInfo.bytes / 1024 / 1024).toFixed(2)}MB (limit: {(sizeInfo.displayLimit / 1024 / 1024).toFixed(2)}MB)
            </p>
          </div>
          <Button
            onClick={handleCopy}
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
          >
            <Copy className="h-4 w-4" />
            {copiedToClipboard ? "Copied!" : "Copy raw response"}
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-950">{title}</h3>
          {description && (
            <p className="mt-1 text-sm text-slate-600">{description}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {redact && (
            <Badge tone="info">
              {additionalRedactionKeys.length > 0 ? "Redacted" : "Auto-redacted"}
            </Badge>
          )}
          {previewContent.truncated && (
            <Badge tone="warning">
              {previewContent.totalLines} total lines
            </Badge>
          )}
          <Badge tone="neutral">
            {sizeInfo.category === "small"
              ? `${(sizeInfo.bytes / 1024).toFixed(1)}KB`
              : sizeInfo.category === "medium"
                ? `${(sizeInfo.bytes / 1024).toFixed(1)}KB`
                : `${(sizeInfo.bytes / 1024 / 1024).toFixed(2)}MB`}
          </Badge>
        </div>
      </CardHeader>

      <CardBody className="space-y-4">
        {/* Expandable preview/full content */}
        <div className="rounded-md bg-slate-950">
          <pre className="overflow-auto p-4 text-xs leading-5 text-slate-100">
            <code>{previewContent.content}</code>
          </pre>

          {previewContent.truncated && (
            <div className="flex items-center justify-between border-t border-slate-800 px-4 py-3">
              <p className="text-xs text-slate-400">
                Showing {previewContent.content.split("\n").length} of {previewContent.totalLines} lines
              </p>
              <button
                onClick={() => setExpanded(!expanded)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800"
                aria-expanded={expanded}
              >
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${
                    expanded ? "rotate-180" : ""
                  }`}
                />
                {expanded ? "Collapse" : "Show more"}
              </button>
            </div>
          )}
        </div>

        {/* Full content when expanded */}
        {expanded && previewContent.truncated && (
          <div className="rounded-md bg-slate-950">
            <pre className="max-h-96 overflow-auto p-4 text-xs leading-5 text-slate-100">
              <code>{displayContent}</code>
            </pre>
            <div className="border-t border-slate-800 px-4 py-2">
              <p className="text-xs text-slate-400">Showing all {previewContent.totalLines} lines</p>
            </div>
          </div>
        )}

        {/* Copy button */}
        <div className="flex gap-2">
          <Button
            onClick={handleCopy}
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-initial"
          >
            <Copy className="h-4 w-4" />
            {copiedToClipboard ? "Copied!" : "Copy to clipboard"}
          </Button>

          {redact && (
            <div className="flex-1 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-600 sm:flex-initial">
              Sensitive data redacted before copy
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

/**
 * Lightweight preview component for responses in compact contexts.
 * Shows a truncated preview with option to open full viewer.
 */
export function McpResponsePreview({
  response,
  title = "Response",
  onOpenFull?: () => void
}: {
  response: unknown;
  title?: string;
  onOpenFull?: () => void;
}) {
  const previewContent = truncateForPreview(formatResponseForDisplay(response));

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <div className="rounded-md bg-slate-950">
        <pre className="max-h-40 overflow-auto p-3 text-xs leading-4 text-slate-100">
          <code>{previewContent.content}</code>
        </pre>
      </div>
      {previewContent.truncated && onOpenFull && (
        <button
          onClick={onOpenFull}
          className="text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          View full response ({previewContent.totalLines} lines)
        </button>
      )}
    </div>
  );
}

/**
 * Container component for displaying multiple responses with proper spacing and layout.
 */
export function McpResponseContainer({
  children,
  className = ""
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-4 ${className}`}>
      {children}
    </div>
  );
}
