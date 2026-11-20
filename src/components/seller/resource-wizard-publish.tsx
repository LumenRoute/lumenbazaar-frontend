"use client";

import { AlertCircle, CheckCircle2, AlertTriangle, Loader } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { apiClient } from "@/services/api/client";
import {
  RESOURCE_PUBLISH_OMITTED_FIELDS,
  RESOURCE_PUBLISH_PUBLIC_FIELDS,
  buildResourcePublishPayload,
  type ResourceDraft
} from "@/services/resource-creation";
import type { ResourceValidationResult } from "@/services/api/schemas";

import { useSellerSession } from "./seller-session-provider";

type ResourceWizardPublishProps = {
  draft: ResourceDraft;
  onPrev: () => void;
  onPublish?: () => void;
  sellerId: string;
  isLoading?: boolean;
};

export function ResourceWizardPublish({
  draft,
  onPrev,
  onPublish,
  sellerId,
  isLoading = false
}: ResourceWizardPublishProps) {
  const { canMutate } = useSellerSession();
  const [validationResult, setValidationResult] = useState<ResourceValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // The preview and every request read this one normalized payload, so what a
  // seller reviews is exactly what validation and publish receive.
  const payload = useMemo(() => {
    try {
      return buildResourcePublishPayload(draft, sellerId);
    } catch {
      return null;
    }
  }, [draft, sellerId]);

  // Validate the exact payload shown in the preview.
  useEffect(() => {
    async function validate() {
      if (payload === null) {
        setError("Resource is incomplete. Please review all required fields.");
        return;
      }

      setValidating(true);
      setError(null);
      setValidationResult(null);

      try {
        const result = await apiClient.validateResource(payload);

        setValidationResult(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Validation failed";
        setError(message);
        setValidationResult({
          valid: false,
          errors: [{ field: "general", message }],
          warnings: []
        });
      } finally {
        setValidating(false);
      }
    }

    validate();
  }, [payload]);

  async function handlePublish() {
    if (payload === null) {
      setError("Resource is incomplete. Please fix errors before publishing.");
      return;
    }

    if (!validationResult?.valid) {
      setError("Resource validation failed. Please fix errors before publishing.");
      return;
    }

    setPublishing(true);
    setError(null);

    try {
      await apiClient.createResource(payload);

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
              Your resource has been successfully published to the catalog and is now available for
              buyers.
            </p>
          </div>

          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-medium text-green-900">What&apos;s next?</p>
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

          {/* Read-only preview of the exact payload that publish submits. */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-700">Publish preview</p>
            <p className="mt-1 text-xs text-slate-500">
              Read-only view of the exact normalized metadata that becomes public on submit.
            </p>
            {payload === null ? (
              <p className="mt-3 text-xs text-red-700">
                Preview appears once every required publish field is valid.
              </p>
            ) : (
              <>
                <dl className="mt-3 grid gap-3 text-xs md:grid-cols-2">
                  {RESOURCE_PUBLISH_PUBLIC_FIELDS.map((field) => (
                    <div
                      className={
                        field === "description" ||
                        field === "inputSchema" ||
                        field === "outputSchema"
                          ? "md:col-span-2"
                          : undefined
                      }
                      key={field}
                    >
                      <dt className="font-medium text-slate-700">{publishFieldLabels[field]}</dt>
                      <dd className="mt-1 break-words text-slate-600">
                        {formatPreviewValue(payload[field])}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-xs text-slate-500">
                  Not submitted: {RESOURCE_PUBLISH_OMITTED_FIELDS.join(", ")} (local draft
                  bookkeeping only).
                </p>
              </>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Navigation */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {canMutate
              ? validationResult?.valid
                ? "Ready to publish"
                : "Validation pending"
              : "Re-authenticate to publish. Your draft is preserved."}
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
                !canMutate ||
                payload === null ||
                !validationResult?.valid ||
                publishing ||
                validating ||
                isLoading ||
                success
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

const publishFieldLabels: Record<(typeof RESOURCE_PUBLISH_PUBLIC_FIELDS)[number], string> = {
  amount: "Amount",
  assetCode: "Asset code",
  assetIssuer: "Asset issuer",
  description: "Description",
  extensions: "Extensions",
  inputSchema: "Input schema",
  name: "Name",
  network: "Network",
  outputSchema: "Output schema",
  payTo: "Pay to",
  routeTemplate: "Route template",
  sellerId: "Seller ID",
  type: "Type",
  url: "URL"
};

function formatPreviewValue(value: unknown): string {
  if (value === undefined || value === null || value === "") {
    return "Not included";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}
