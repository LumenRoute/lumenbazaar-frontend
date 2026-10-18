"use client";

import { AlertTriangle, ArrowRight, CheckCircle2, Loader, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { Resource } from "@/services/api/schemas";
import type { ResourceDraft } from "@/services/resource-creation";
import {
  loadResourceForEdit,
  ResourceEditError,
  saveResourceEdit,
  validateResourceEdit,
  type ResourceDiffField
} from "@/services/resource-edit";

type ResourceEditReviewProps = {
  base: Resource;
  draft: ResourceDraft;
  onBack: () => void;
  onReplaceVersion: (snapshot: { base: Resource; draft: ResourceDraft }) => void;
  onSaved: (resource: Resource) => void;
};

export function ResourceEditReview({
  base,
  draft,
  onBack,
  onReplaceVersion,
  onSaved
}: ResourceEditReviewProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<Resource | null>(null);
  const [overwriteConfirmed, setOverwriteConfirmed] = useState(false);
  const [error, setError] = useState<{
    code: string;
    issues: Array<{ field: string; message: string }>;
    message: string;
  } | null>(null);
  const [unchanged, setUnchanged] = useState(false);
  const validation = useMemo(() => validateResourceEdit(base, draft), [base, draft]);
  const changedFields = validation.diff.fields.filter((field) => field.changed);

  async function save(overwriteServerVersion = false) {
    setError(null);
    setUnchanged(false);

    if (!validation.valid) {
      setError({
        code: "VALIDATION_FAILED",
        issues: validation.errors,
        message: "Fix the highlighted fields before publishing a new version."
      });
      return;
    }

    setSaving(true);
    try {
      const result = await saveResourceEdit({
        base: overwriteServerVersion && conflict !== null ? conflict : base,
        draft,
        overwriteServerVersion
      });

      if (!result.changed) {
        setUnchanged(true);
        return;
      }

      onSaved(result.resource);
    } catch (caught) {
      const editError =
        caught instanceof ResourceEditError
          ? caught
          : new ResourceEditError({
              code: "BACKEND_UNAVAILABLE",
              message: caught instanceof Error ? caught.message : "The new version was not saved."
            });

      if (editError.code === "VERSION_CONFLICT") {
        setConflict(editError.serverResource ?? null);
        setOverwriteConfirmed(false);
        return;
      }

      setError({ code: editError.code, issues: editError.issues, message: editError.message });
    } finally {
      setSaving(false);
    }
  }

  async function loadServerVersion() {
    setSaving(true);
    setError(null);
    try {
      const snapshot = await loadResourceForEdit(base.id);
      setConflict(null);
      onReplaceVersion({ base: snapshot.base, draft: snapshot.draft });
    } catch (caught) {
      setError({
        code: "BACKEND_UNAVAILABLE",
        issues: [],
        message:
          caught instanceof Error ? caught.message : "The server version could not be reloaded."
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Review version changes</h2>
              <p className="mt-1 text-sm text-slate-600">
                Comparing against the version loaded at {new Date(base.updatedAt).toLocaleString()}.
              </p>
            </div>
            <Badge tone={validation.diff.changed ? "warning" : "neutral"}>
              {validation.diff.changed
                ? `${changedFields.length} changed ${changedFields.length === 1 ? "field" : "fields"}`
                : "No changes"}
            </Badge>
          </div>
        </CardHeader>
        <CardBody className="space-y-5">
          {conflict !== null ? (
            <div
              className="space-y-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900"
              role="alert"
            >
              <div className="flex items-center gap-2 font-semibold">
                <ShieldAlert aria-hidden="true" className="h-4 w-4" />
                Version conflict
              </div>
              <p>
                A newer server version exists (last updated{" "}
                {new Date(conflict.updatedAt).toLocaleString()}). Your draft is preserved. Reload
                the server version or explicitly overwrite it.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  disabled={saving}
                  onClick={() => void loadServerVersion()}
                  type="button"
                  variant="secondary"
                >
                  Reload server version
                </Button>
                <Button
                  disabled={saving || !overwriteConfirmed}
                  onClick={() => void save(true)}
                  type="button"
                  variant="danger"
                >
                  Overwrite newer version
                </Button>
              </div>
              <label className="flex items-start gap-2">
                <input
                  checked={overwriteConfirmed}
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                  onChange={(event) => setOverwriteConfirmed(event.target.checked)}
                  type="checkbox"
                />
                <span>
                  I understand this replaces the newer server version with my draft. Nothing is
                  overwritten until I confirm.
                </span>
              </label>
            </div>
          ) : null}

          {validation.diff.paymentCriticalChanges.length > 0 ? (
            <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-4">
              <div className="flex items-center gap-2 font-semibold text-amber-900">
                <AlertTriangle aria-hidden="true" className="h-4 w-4" />
                Payment-critical changes
              </div>
              <p className="text-sm text-amber-900">
                Endpoint or payment terms changed. Buyers will see the new terms on the next
                published version.
              </p>
              <div className="space-y-2">
                {validation.diff.paymentCriticalChanges.map((field) => (
                  <DiffRow key={field.field} field={field} emphasize />
                ))}
              </div>
            </div>
          ) : null}

          {validation.diff.changed ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Field</th>
                    <th className="px-3 py-2 font-medium">Current version</th>
                    <th className="px-3 py-2 font-medium">New version</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {changedFields.map((field) => (
                    <tr key={field.field}>
                      <td className="px-3 py-3 align-top font-medium text-slate-800">
                        {field.label}
                        {field.paymentCritical ? <Badge tone="warning">Payment</Badge> : null}
                      </td>
                      <td className="max-w-xs whitespace-pre-wrap break-words px-3 py-3 align-top text-slate-600">
                        {field.before || "—"}
                      </td>
                      <td className="max-w-xs whitespace-pre-wrap break-words px-3 py-3 align-top text-slate-950">
                        {field.after || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              The draft matches the current version. Publishing is unnecessary.
            </p>
          )}

          {!validation.valid ? (
            <div
              className="space-y-1 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800"
              role="alert"
            >
              <p className="font-medium">Validation failed</p>
              {validation.errors.map((issue, index) => (
                <p key={`${issue.field}-${index}`}>
                  <span className="font-medium">{issue.field}:</span> {issue.message}
                </p>
              ))}
            </div>
          ) : null}

          {error !== null ? (
            <div
              className="space-y-1 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800"
              role="alert"
            >
              <p className="font-medium">{error.code}</p>
              <p>{error.message}</p>
              {error.issues.map((issue, index) => (
                <p key={`${issue.field}-${index}`}>
                  <span className="font-medium">{issue.field}:</span> {issue.message}
                </p>
              ))}
            </div>
          ) : null}

          {unchanged ? (
            <div
              className="flex items-center gap-2 rounded-md border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900"
              role="status"
            >
              <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
              No changes to publish.
            </div>
          ) : null}

          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              checked={confirmed}
              className="mt-1 h-4 w-4 rounded border-slate-300"
              onChange={(event) => setConfirmed(event.target.checked)}
              type="checkbox"
            />
            <span>I reviewed the endpoint, schema, and payment term changes for this version.</span>
          </label>
        </CardBody>
      </Card>

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button onClick={onBack} type="button" variant="secondary">
            ← Back
          </Button>
          <Button
            disabled={saving || !confirmed || !validation.diff.changed || conflict !== null}
            onClick={() => void save(false)}
            type="button"
          >
            {saving ? (
              <Loader aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            )}
            {saving ? "Publishing" : "Publish new version"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function DiffRow({ emphasize, field }: { emphasize?: boolean; field: ResourceDiffField }) {
  return (
    <div
      className={`rounded border px-3 py-2 text-sm ${
        emphasize ? "border-amber-200 bg-white" : "border-slate-200 bg-white"
      }`}
    >
      <p className="font-medium text-slate-800">{field.label}</p>
      <p className="mt-1 break-words text-slate-600">{field.before || "—"}</p>
      <p className="break-words text-slate-950">{field.after || "—"}</p>
    </div>
  );
}
