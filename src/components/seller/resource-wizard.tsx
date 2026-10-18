"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/ui/surfaces";
import type { Resource } from "@/services/api/schemas";
import {
  clearEditDraft,
  loadEditDraft,
  loadResourceForEdit,
  saveEditDraft
} from "@/services/resource-edit";
import { ResourceEditReview } from "./resource-edit-review";
import { ResourceWizardBasicInfo } from "./resource-wizard-basic-info";
import { ResourceWizardPricing } from "./resource-wizard-pricing";
import { ResourceWizardMetadata } from "./resource-wizard-metadata";
import { ResourceWizardSnippets } from "./resource-wizard-snippets";
import { ResourceWizardPublish } from "./resource-wizard-publish";
import {
  createEmptyDraft,
  loadDraftFromStorage,
  saveDraftToStorage,
  updateDraft,
  clearDraftFromStorage,
  type ResourceDraft
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
  const steps = resourceId === undefined ? CREATE_STEPS : EDIT_STEPS;

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

  // Load a new-resource draft from storage on mount.
  useEffect(() => {
    if (resourceId !== undefined) return;
    const stored = loadDraftFromStorage();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(stored || createEmptyDraft());
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

  async function handlePublish() {
    setIsLoading(true);
    try {
      if (draft) {
        onPublish?.(draft);
        // Clear draft after successful publish
        clearDraftFromStorage();
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
      <div className="flex items-center justify-between border-t border-slate-200 pt-6">
        <Button onClick={onCancel} variant="secondary" type="button">
          Save and exit
        </Button>
        <p className="text-xs text-slate-500">
          Step {currentStepIndex + 1} of {steps.length}
        </p>
      </div>
    </div>
  );
}
