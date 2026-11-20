"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/ui/surfaces";
import { downloadFile } from "@/lib/export-utils";
import { hasMeaningfulDraftChanges } from "@/services/ui-state";
import type { Resource } from "@/services/api/schemas";
import {
  clearEditDraft,
  draftFromResource,
  loadEditDraft,
  loadResourceForEdit,
  saveEditDraft
} from "@/services/resource-edit";
import {
  exportResourceDraftToJson,
  importResourceDraftFromJson,
  ResourceDraftImportError
} from "@/services/resource-creation";
import { useUnsavedChangesGuard } from "./use-unsaved-changes";
import { ResourceEditReview } from "./resource-edit-review";
import { ResourceWizardBasicInfo } from "./resource-wizard-basic-info";
import { ResourceWizardPricing } from "./resource-wizard-pricing";
import { ResourceWizardMetadata } from "./resource-wizard-metadata";
import { ResourceWizardSnippets } from "./resource-wizard-snippets";
import { ResourceWizardPublish } from "./resource-wizard-publish";
import {
  createEmptyDraft,
  formatDraftAge,
  loadDraftRecoveryFromStorage,
  saveDraftToStorage,
  updateDraft,
  clearDraftFromStorage,
  type ResourceDraft,
  type ResourceDraftRecovery
} from "@/services/resource-creation";

export type WizardStep = "basic-info" | "pricing" | "metadata" | "snippets" | "review" | "publish";

type ResourceWizardProps = {
  onCancel: () => void;
  onPublish?: (draft: ResourceDraft) => void;
  /** Enables editing of an existing resource version instead of creation. */
  resourceId?: string;
  sellerId: string;
};

const CREATE_STEPS: Array<{ id: WizardStep; label: string; description: string }> = [
  { id: "basic-info", label: "Resource Info", description: "Name, type, and endpoint" },
  { id: "pricing", label: "Pricing", description: "Network, asset, and amount" },
  { id: "metadata", label: "Metadata", description: "Input/output schemas and extensions" },
  { id: "snippets", label: "Integration", description: "Code snippets and setup" },
  { id: "publish", label: "Publish", description: "Validate and publish" }
];

const EDIT_STEPS: Array<{ id: WizardStep; label: string; description: string }> = [
  ...CREATE_STEPS.filter((step) => step.id !== "publish"),
  { id: "review", label: "Review changes", description: "Compare versions and publish" }
];

export function ResourceWizard({ onCancel, onPublish, resourceId, sellerId }: ResourceWizardProps) {
  const [draft, setDraft] = useState<ResourceDraft | null>(null);
  const [editBase, setEditBase] = useState<Resource | null>(null);
  const [editError, setEditError] = useState<Error | null>(null);
  const [editLoading, setEditLoading] = useState(resourceId !== undefined);
  const [currentStep, setCurrentStep] = useState<WizardStep>("basic-info");
  const [isLoading, setIsLoading] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [baseline, setBaseline] = useState<ResourceDraft | null>(null);
  const [draftNotice, setDraftNotice] = useState<string | undefined>(undefined);
  const [recovery, setRecovery] = useState<Pick<
    ResourceDraftRecovery,
    "savedAt" | "schemaVersion"
  > | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const steps = resourceId === undefined ? CREATE_STEPS : EDIT_STEPS;
  const dirty = draft !== null && hasMeaningfulDraftChanges(draft, baseline);

  useUnsavedChangesGuard(dirty && !isLoading);

  // Load an existing version from the API; a preserved draft wins over the
  // server version so a conflict never discards local edits.
  useEffect(() => {
    if (resourceId === undefined) return;
    let cancelled = false;

    void loadResourceForEdit(resourceId)
      .then((snapshot) => {
        if (cancelled) return;
        setEditBase(snapshot.base);
        setDraft(loadEditDraft(resourceId) ?? snapshot.draft);
        setBaseline(draftFromResource(snapshot.base));
        setEditLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setEditError(
          error instanceof Error ? error : new Error("The resource could not be loaded.")
        );
        setEditLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [resourceId]);

  // Load a new-resource draft from storage on mount and surface an explicit
  // recovery prompt with its age and storage schema version.
  useEffect(() => {
    if (resourceId !== undefined) return;
    const stored = loadDraftRecoveryFromStorage();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(stored?.draft ?? createEmptyDraft());
    setBaseline(createEmptyDraft());
    setRecovery(
      stored === null ? null : { savedAt: stored.savedAt, schemaVersion: stored.schemaVersion }
    );
  }, [resourceId]);

  // Auto-save the draft to the matching storage scope whenever it changes.
  useEffect(() => {
    if (draft && unsavedChanges) {
      if (resourceId === undefined) {
        saveDraftToStorage(draft);
      } else {
        saveEditDraft(resourceId, draft);
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUnsavedChanges(false);
    }
  }, [draft, resourceId, unsavedChanges]);

  if (editLoading) {
    return <LoadingState label="Loading current resource version" />;
  }

  if (editError !== null) {
    return (
      <ErrorState
        code="RESOURCE_UNAVAILABLE"
        description={editError.message}
        title="Resource unavailable"
      />
    );
  }

  if (!draft) {
    return null;
  }

  function handleUpdate(updates: Partial<ResourceDraft>) {
    setDraft((prev) => {
      if (!prev) return null;
      return updateDraft(prev, updates);
    });
    setUnsavedChanges(true);
  }

  function handleNext() {
    const stepIndex = steps.findIndex((s) => s.id === currentStep);
    if (stepIndex < steps.length - 1) {
      setCurrentStep(steps[stepIndex + 1]!.id);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handlePrev() {
    const stepIndex = steps.findIndex((s) => s.id === currentStep);
    if (stepIndex > 0) {
      setCurrentStep(steps[stepIndex - 1]!.id);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handleCancel() {
    if (dirty && !window.confirm("Discard unsaved changes and leave this page?")) {
      return;
    }

    onCancel();
  }

  function handleDiscard() {
    setRecovery(null);
    const empty = createEmptyDraft();

    if (resourceId === undefined) {
      clearDraftFromStorage();
    } else {
      clearEditDraft(resourceId);
    }

    const reset = resourceId === undefined || baseline === null ? empty : baseline;
    setDraft(reset);
    setBaseline(reset);
    setUnsavedChanges(false);
    setDraftNotice("Draft discarded. This form now matches the saved version.");
  }

  function handleExportDraft() {
    if (!draft) return;

    try {
      const json = exportResourceDraftToJson(draft);
      downloadFile(json, `resource-draft-${resourceId ?? "new"}.json`, "application/json");
      setDraftNotice("Draft exported without any session or wallet secrets.");
    } catch {
      setDraftNotice("The draft could not be exported because it is not schema-valid yet.");
    }
  }

  async function handleImportFile(file: File) {
    try {
      const imported = importResourceDraftFromJson(await file.text());
      setDraft(imported);
      setUnsavedChanges(true);
      setDraftNotice(
        "Draft imported. Review every step before publishing; nothing is sent to the API yet."
      );
    } catch (error) {
      setDraftNotice(
        error instanceof ResourceDraftImportError
          ? `Import rejected: ${error.message}`
          : "Import rejected: the file could not be read."
      );
    }
  }

  async function handlePublish() {
    setIsLoading(true);
    try {
      if (draft) {
        onPublish?.(draft);
        // Successful publish removes the local draft; discard does the same.
        clearDraftFromStorage();
        setRecovery(null);
      }
    } finally {
      setIsLoading(false);
    }
  }

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <Card className="p-0">
        <div className="h-1 w-full bg-slate-200">
          <div
            className="h-full bg-teal-600 transition-all"
            style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
          />
        </div>
      </Card>

      {/* Steps indicator */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {steps.map((step, index) => (
          <button
            key={step.id}
            onClick={() => setCurrentStep(step.id)}
            className={`flex-shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              step.id === currentStep
                ? "bg-teal-100 text-teal-700"
                : index < currentStepIndex
                  ? "bg-green-100 text-green-700"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <span className="hidden sm:inline">{step.label}</span>
            <span className="sm:hidden">{index + 1}</span>
          </button>
        ))}
      </div>

      {/* Current step description */}
      <div>
        <h1 className="text-2xl font-bold text-slate-950">{steps[currentStepIndex]?.label}</h1>
        <p className="mt-1 text-slate-600">{steps[currentStepIndex]?.description}</p>
      </div>

      {recovery !== null ? (
        <div
          className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between"
          role="status"
        >
          <p className="text-sm text-amber-900">
            Recovered an autosaved draft from {formatDraftAge(recovery.savedAt)} ago (schema v
            {recovery.schemaVersion}). Review it, or discard it to start clean.
          </p>
          <div className="flex gap-2">
            <Button onClick={() => setRecovery(null)} type="button" variant="secondary">
              Keep editing
            </Button>
            <Button onClick={handleDiscard} type="button" variant="ghost">
              Discard recovered draft
            </Button>
          </div>
        </div>
      ) : null}

      {/* Step content */}
      <div className="min-h-96 space-y-6">
        {currentStep === "basic-info" && draft && (
          <ResourceWizardBasicInfo
            draft={draft}
            onUpdate={handleUpdate}
            onNext={handleNext}
            isLoading={isLoading}
          />
        )}

        {currentStep === "pricing" && draft && (
          <ResourceWizardPricing
            draft={draft}
            onUpdate={handleUpdate}
            onNext={handleNext}
            onPrev={handlePrev}
            isLoading={isLoading}
          />
        )}

        {currentStep === "metadata" && draft && (
          <ResourceWizardMetadata
            draft={draft}
            onUpdate={handleUpdate}
            onNext={handleNext}
            onPrev={handlePrev}
            isLoading={isLoading}
          />
        )}

        {currentStep === "snippets" && draft && (
          <ResourceWizardSnippets
            draft={draft}
            onNext={handleNext}
            onPrev={handlePrev}
            isLoading={isLoading}
          />
        )}

        {currentStep === "review" && draft && editBase !== null && (
          <ResourceEditReview
            base={editBase}
            draft={draft}
            onBack={handlePrev}
            onReplaceVersion={({ base, draft: replacement }) => {
              setEditBase(base);
              setDraft(replacement);
              setUnsavedChanges(true);
            }}
            onSaved={() => {
              if (resourceId !== undefined) clearEditDraft(resourceId);
              onPublish?.(draft);
            }}
          />
        )}

        {currentStep === "publish" && draft && (
          <ResourceWizardPublish
            draft={draft}
            onPrev={handlePrev}
            onPublish={handlePublish}
            sellerId={sellerId}
            isLoading={isLoading}
          />
        )}
      </div>

      {/* Footer navigation */}
      {resourceId === undefined ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4">
          <Button onClick={handleExportDraft} type="button" variant="secondary">
            Export draft
          </Button>
          <Button onClick={() => importInputRef.current?.click()} type="button" variant="secondary">
            Import draft
          </Button>
          <input
            accept="application/json,.json"
            aria-label="Import draft JSON file"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void handleImportFile(file);
            }}
            ref={importInputRef}
            type="file"
          />
          <p className="text-xs text-slate-500">
            Draft files contain only non-secret metadata from this form.
          </p>
        </div>
      ) : null}

      {draftNotice !== undefined ? (
        <p className="text-sm text-slate-700" role="status">
          {draftNotice}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleCancel} variant="secondary" type="button">
            Save and exit
          </Button>
          <Button disabled={!dirty} onClick={handleDiscard} type="button" variant="ghost">
            Discard draft
          </Button>
        </div>
        <p className="text-xs text-slate-500">
          Step {currentStepIndex + 1} of {steps.length}
          {dirty ? " \u00b7 Unsaved changes" : ""}
        </p>
      </div>
    </div>
  );
}
