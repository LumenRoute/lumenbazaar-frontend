"use client";

import { Copy, Check } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { generateSnippet, type MiddlewareFramework } from "@/services/middleware-snippets";
import { type ResourceDraft } from "@/services/resource-creation";

type ResourceWizardSnippetsProps = {
  draft: ResourceDraft;
  onNext: () => void;
  onPrev: () => void;
  isLoading?: boolean;
};

const FRAMEWORKS: Array<{ id: MiddlewareFramework; label: string; icon: string }> = [
  { id: "express", label: "Express.js", icon: "⚡" },
  { id: "fastify", label: "Fastify", icon: "🚀" },
  { id: "nextjs", label: "Next.js", icon: "▲" }
];

export function ResourceWizardSnippets({
  draft,
  onNext,
  onPrev,
  isLoading = false
}: ResourceWizardSnippetsProps) {
  const [selectedFramework, setSelectedFramework] = useState<MiddlewareFramework>("express");
  const [copied, setCopied] = useState(false);

  const snippet = generateSnippet(selectedFramework, draft);

  function copyToClipboard() {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Integration snippets</h2>
            <p className="mt-1 text-sm text-slate-600">
              Copy ready-to-use middleware code for your framework. The snippet includes your
              resource metadata and payment requirement enforcement.
            </p>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          {/* Framework Selector */}
          <div className="grid grid-cols-3 gap-2 md:grid-cols-3">
            {FRAMEWORKS.map((fw) => (
              <button
                key={fw.id}
                onClick={() => setSelectedFramework(fw.id)}
                className={`rounded-lg border-2 p-3 text-center transition-colors ${
                  selectedFramework === fw.id
                    ? "border-teal-600 bg-teal-50 text-teal-900"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                <div className="text-xl">{fw.icon}</div>
                <div className="text-xs font-medium md:text-sm">{fw.label}</div>
              </button>
            ))}
          </div>

          {/* Code Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-700">
                {FRAMEWORKS.find((f) => f.id === selectedFramework)?.label} Middleware
              </p>
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-1 rounded-md bg-slate-900 px-2 py-1 text-xs text-white hover:bg-slate-800"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Copy code
                  </>
                )}
              </button>
            </div>

            <pre className="overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-4 text-xs text-slate-100">
              <code>{snippet}</code>
            </pre>
          </div>

          {/* Instructions */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <p className="font-medium">Setup instructions:</p>
            <ol className="mt-2 list-inside list-decimal space-y-1 text-xs">
              <li>
                Install the SDK:{" "}
                <code className="text-blue-700">npm install @lumenbazaar/seller-sdk</code>
              </li>
              <li>Copy the code snippet above into your project</li>
              <li>
                Set environment variables:{" "}
                <code className="text-blue-700">LUMENBAZAAR_API_URL</code>
              </li>
              <li>Deploy your endpoint to make it accessible</li>
              <li>Return to publish your resource in the catalog</li>
            </ol>
          </div>

          {/* Resource Summary */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium text-slate-700">Resource summary</p>
            <div className="mt-2 grid gap-2 text-xs text-slate-600 md:grid-cols-2">
              <div>
                <p className="font-medium text-slate-700">{draft.name}</p>
                <p className="text-slate-500">{draft.type === "http" ? "HTTP API" : "MCP Tool"}</p>
              </div>
              <div>
                <p className="font-medium text-slate-700">
                  {draft.amount} {draft.assetCode}
                </p>
                <p className="text-slate-500">{draft.network}</p>
              </div>
              <div>
                <p className="font-medium text-slate-700">{draft.url}</p>
                <p className="text-slate-500">Endpoint</p>
              </div>
              <div>
                <p className="font-medium text-slate-700">{draft.routeTemplate}</p>
                <p className="text-slate-500">Route</p>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Navigation */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Framework: {FRAMEWORKS.find((f) => f.id === selectedFramework)?.label}
          </p>
          <div className="flex gap-2">
            <Button onClick={onPrev} variant="secondary" disabled={isLoading} type="button">
              ← Back
            </Button>
            <Button onClick={onNext} disabled={isLoading} type="button">
              Continue to publish →
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
