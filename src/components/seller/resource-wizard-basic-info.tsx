"use client";

import { AlertCircle } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import {
  routeTemplateError,
  type ResourceDraft
} from "@/services/resource-creation";
import type { ResourceType } from "@/services/api/schemas";

type ResourceWizardBasicInfoProps = {
  draft: ResourceDraft;
  onUpdate: (updates: Partial<ResourceDraft>) => void;
  onNext: () => void;
  isLoading?: boolean;
};

export function ResourceWizardBasicInfo({
  draft,
  onUpdate,
  onNext,
  isLoading = false
}: ResourceWizardBasicInfoProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};

    if (!draft.name.trim()) {
      newErrors.name = "Resource name is required";
    } else if (draft.name.length > 120) {
      newErrors.name = "Resource name must be 120 characters or less";
    }

    if (!draft.description.trim()) {
      newErrors.description = "Description is required";
    } else if (draft.description.length > 1000) {
      newErrors.description = "Description must be 1000 characters or less";
    }

    if (!draft.url.trim()) {
      newErrors.url = "Endpoint URL is required";
    } else {
      try {
        new URL(draft.url);
      } catch {
        newErrors.url = "Must be a valid URL (e.g., https://example.com)";
      }
    }

    const templateError = routeTemplateError(draft.routeTemplate, draft.type);
    if (templateError) {
      newErrors.routeTemplate = templateError;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleNext() {
    if (validateForm()) {
      onNext();
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Resource information</h2>
          <p className="mt-1 text-sm text-slate-600">
            Define the basic details of your paid endpoint or MCP tool.
          </p>
        </div>
      </CardHeader>
      <CardBody className="space-y-6">
        <div className="space-y-4">
          <label className="space-y-1">
            <span className="block text-sm font-medium text-slate-700">
              Resource type <span className="text-red-600">*</span>
            </span>
            <div className="flex gap-3">
              {["http", "mcp"].map((type) => (
                <button
                  key={type}
                  onClick={() => onUpdate({ type: type as ResourceType })}
                  className={`flex-1 rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                    draft.type === type
                      ? "border-teal-600 bg-teal-50 text-teal-700"
                      : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                  }`}
                >
                  {type === "http" ? "HTTP API" : "MCP Tool"}
                </button>
              ))}
            </div>
          </label>

          <label className="space-y-1">
            <span className="block text-sm font-medium text-slate-700">
              Resource name <span className="text-red-600">*</span>
            </span>
            <input
              type="text"
              placeholder="e.g., Paid Weather API"
              maxLength={120}
              value={draft.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className={`w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors ${
                errors.name ? "border-red-600 focus:ring-red-100" : "border-slate-300 focus:ring-teal-100"
              } focus:border-teal-700 focus:ring-2`}
            />
            {errors.name ? <p className="text-xs text-red-600">{errors.name}</p> : null}
            <p className="text-xs text-slate-500">{draft.name.length}/120 characters</p>
          </label>

          <label className="space-y-1">
            <span className="block text-sm font-medium text-slate-700">
              Description <span className="text-red-600">*</span>
            </span>
            <textarea
              placeholder="Describe what this resource does and what data it provides"
              maxLength={1000}
              value={draft.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
              className={`min-h-28 w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors ${
                errors.description ? "border-red-600 focus:ring-red-100" : "border-slate-300 focus:ring-teal-100"
              } focus:border-teal-700 focus:ring-2`}
            />
            {errors.description ? <p className="text-xs text-red-600">{errors.description}</p> : null}
            <p className="text-xs text-slate-500">{draft.description.length}/1000 characters</p>
          </label>

          <label className="space-y-1">
            <span className="block text-sm font-medium text-slate-700">
              Endpoint URL <span className="text-red-600">*</span>
            </span>
            <input
              type="url"
              placeholder="https://example.com"
              value={draft.url}
              onChange={(e) => onUpdate({ url: e.target.value })}
              className={`w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors ${
                errors.url ? "border-red-600 focus:ring-red-100" : "border-slate-300 focus:ring-teal-100"
              } focus:border-teal-700 focus:ring-2`}
            />
            {errors.url ? <p className="text-xs text-red-600">{errors.url}</p> : null}
          </label>

          <label className="space-y-1">
            <span className="block text-sm font-medium text-slate-700">
              Route template <span className="text-red-600">*</span>
            </span>
            {draft.type === "http" ? (
              <>
                <input
                  type="text"
                  placeholder="/weather/{city}"
                  value={draft.routeTemplate}
                  onChange={(e) => onUpdate({ routeTemplate: e.target.value })}
                  className={`w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors ${
                    errors.routeTemplate ? "border-red-600 focus:ring-red-100" : "border-slate-300 focus:ring-teal-100"
                  } focus:border-teal-700 focus:ring-2`}
                />
                <p className="text-xs text-slate-500">
                  Start with / and use {'{'} curly braces {'}'} for parameters
                </p>
              </>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="mcp://server-name/tool-name"
                  value={draft.routeTemplate}
                  onChange={(e) => onUpdate({ routeTemplate: e.target.value })}
                  className={`w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors ${
                    errors.routeTemplate ? "border-red-600 focus:ring-red-100" : "border-slate-300 focus:ring-teal-100"
                  } focus:border-teal-700 focus:ring-2`}
                />
                <p className="text-xs text-slate-500">Format: mcp://server-name/tool-name</p>
              </>
            )}
            {errors.routeTemplate ? (
              <div className="mt-2 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-600" aria-hidden="true" />
                <p className="text-xs text-red-600">{errors.routeTemplate}</p>
              </div>
            ) : null}
          </label>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 pt-6">
          <Badge>{draft.type === "http" ? "HTTP API" : "MCP Tool"}</Badge>
          <Button onClick={handleNext} disabled={isLoading} type="button">
            Continue to pricing →
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
