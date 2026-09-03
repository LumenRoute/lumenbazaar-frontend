"use client";

import { AlertCircle, CheckCircle2, AlertTriangle, Loader } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { apiClient } from "@/services/api/client";
import { type ResourceDraft } from "@/services/resource-creation";
import type { ResourceValidationResult } from "@/services/api/schemas";

type ResourceWizardPublishProps = {
  draft: ResourceDraft;
  onPrev: () => void;
  onPublish?: () => void;
  isLoading?: boolean;
};

export function ResourceWizardPublish({
  draft,
  onPrev,
  onPublish,
  isLoading = false
}: ResourceWizardPublishProps) {
  const [validationResult, setValidationResult] = useState<ResourceValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Validate resource on mount
  useEffect(() => {
    async function validate() {
      if (!draft.name || !draft.network || !draft.assetCode || !draft.payTo) {
        setError("Resource is incomplete. Please review all required fields.");
        return;
      }

      setValidating(true);
      setError(null);

      try {
        const result = await apiClient.validateResource({
          name: draft.name,
          description: draft.description,
          type: draft.type,
          url: draft.url,
          routeTemplate: draft.routeTemplate,
          network: draft.network || "stellar:testnet",
          assetCode: draft.assetCode || "USDC",
          assetIssuer: draft.assetIssuer || "",
          amount: draft.amount || "0",
          payTo: draft.payTo || "",
          inputSchema: draft.inputSchema || { type: "object", properties: {} },
          outputSchema: draft.outputSchema || { type: "object", properties: {} },
          extensions: draft.extensions
        });

        setValidationResult(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Validation failed";
        setError(message);
        setValidationResult({
          valid: false,
          errors: [{ field: "general", message }]
        });
      } finally {
        setValidating(false);
      }
    }

    validate();
  }, [draft]);

  async function handlePublish() {
    if (!validationResult?.valid) {
      setError("Resource validation failed. Please fix errors before publishing.");
      return;
    }

    setPublishing(true);
    setError(null);

    try {
      await apiClient.createResource({
        name: draft.name,
        description: draft.description,
        type: draft.type,
        url: draft.url,
        routeTemplate: draft.routeTemplate,
        network: draft.network || "stellar:testnet",
        assetCode: draft.assetCode || "USDC",
        assetIssuer: draft.assetIssuer || "",
        amount: draft.amount || "0",
        payTo: draft.payTo || "",
        inputSchema: draft.inputSchema || { type: "object", properties: {} },
        outputSchema: draft.outputSchema || { type: "object", properties: {} },
        extensions: draft.extensions
      });

      setSuccess(true);
      onPublish?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Publication failed";
      setError(message);
    } finally {
      setPublishing(false);
    }
  }

  if (success) {
    return (
      <Card>
        <CardBody className="space-y-6 py-12">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-950">Resource published</h2>
            <p className="mt-2 text-slate-600">
              Your resource has been successfully published to the catalog and is now available for buyers.
            </p>
          </div>

          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-medium text-green-900">What's next?</p>
            <ul className="mt-2 space-y-1 text-sm text-green-800">
              <li>• Your resource is being indexed and will appear in search results</li>
              <li>• Buyers can now discover and test your resource</li>
              <li>• Payments will be processed through the Stellar network</li>
              <li>• View your resources on the seller dashboard</li>
            </ul>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Validate and publish</h2>
            <p className="mt-1 text-sm text-slate-600">
              Review validation results and publish your resource to the catalog.
            </p>
          </div>
        </CardHeader>
        <CardBody className="space-y-6">
          {/* Validation Status */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <p className="font-medium text-slate-700">Validation status</p>
              {validating && (
                <div className="flex items-center gap-2">
                  <Loader className="h-4 w-4 animate-spin text-teal-600" />
                  <span className="text-xs text-slate-500">Validating...</span>
                </div>
              )}
            </div>

            {validationResult && (
              <div
                className={`rounded-lg border p-4 ${
                  validationResult.valid
                    ? "border-green-200 bg-green-50"
                    : "border-red-200 bg-red-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  {validationResult.valid ? (
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
                  )}
                  <div className="flex-1">
                    <p
                      className={`font-medium ${
                        validationResult.valid ? "text-green-900" : "text-red-900"
                      }`}
                    >
                      {validationResult.valid
                        ? "Resource is valid and ready to publish"
                        : "Resource validation failed"}
                    </p>
                    {validationResult.errors && validationResult.errors.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {validationResult.errors.map((error, idx) => (
                          <p key={idx} className="text-xs text-red-800">
                            <span className="font-medium">{error.field}:</span> {error.message}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Warnings */}
          {validationResult?.warnings && validationResult.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-600" />
                <div>
                  <p className="font-medium text-amber-900">Warnings</p>
                  <div className="mt-2 space-y-1">
                    {validationResult.warnings.map((warning, idx) => (
                      <p key={idx} className="text-xs text-amber-800">
                        <span className="font-medium">{warning.field}:</span> {warning.message}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && !validationResult && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
                <div>
                  <p className="font-medium text-red-900">Error</p>
                  <p className="mt-1 text-xs text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Resource Summary */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium text-slate-700">Resource summary</p>
            <div className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-2">
              <div>
                <p className="font-medium text-slate-700">{draft.name}</p>
                <p className="text-slate-500">{draft.description.substring(0, 50)}...</p>
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
          <div className="text-xs text-slate-500">
            {validationResult?.valid ? "Ready to publish" : "Validation pending"}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={onPrev}
              variant="secondary"
              disabled={publishing || validating}
              type="button"
            >
              ← Back
            </Button>
            <Button
              onClick={handlePublish}
              disabled={
                !validationResult?.valid || publishing || validating || isLoading || success
              }
              type="button"
            >
              {publishing ? "Publishing..." : "Publish resource"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
