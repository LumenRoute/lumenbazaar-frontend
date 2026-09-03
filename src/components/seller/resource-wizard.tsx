"use client";

import { AlertCircle, ChevronLeft } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ResourceWizardBasicInfo } from "./resource-wizard-basic-info";
import { ResourceWizardPricing } from "./resource-wizard-pricing";
import {
  createEmptyDraft,
  loadDraftFromStorage,
  saveDraftToStorage,
  updateDraft,
  type ResourceDraft
} from "@/services/resource-creation";

export type WizardStep = "basic-info" | "pricing" | "metadata" | "snippets" | "publish";

type ResourceWizardProps = {
  onCancel: () => void;
  onPublish?: (draft: ResourceDraft) => void;
};

const STEPS: Array<{ id: WizardStep; label: string; description: string }> = [
  { id: "basic-info", label: "Resource Info", description: "Name, type, and endpoint" },
  { id: "pricing", label: "Pricing", description: "Network, asset, and amount" },
  { id: "metadata", label: "Metadata", description: "Input/output schemas and extensions" },
  { id: "snippets", label: "Integration", description: "Code snippets and setup" },
  { id: "publish", label: "Publish", description: "Validate and publish" }
];

export function ResourceWizard({ onCancel, onPublish }: ResourceWizardProps) {
  const [draft, setDraft] = useState<ResourceDraft | null>(null);
  const [currentStep, setCurrentStep] = useState<WizardStep>("basic-info");
  const [isLoading, setIsLoading] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);

  // Load draft from storage on mount
  useEffect(() => {
    const stored = loadDraftFromStorage();
    setDraft(stored || createEmptyDraft());
  }, []);

  // Auto-save draft to localStorage whenever it changes
  useEffect(() => {
    if (draft && unsavedChanges) {
      saveDraftToStorage(draft);
      setUnsavedChanges(false);
    }
  }, [draft, unsavedChanges]);

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
    const stepIndex = STEPS.findIndex((s) => s.id === currentStep);
    if (stepIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[stepIndex + 1]!.id);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handlePrev() {
    const stepIndex = STEPS.findIndex((s) => s.id === currentStep);
    if (stepIndex > 0) {
      setCurrentStep(STEPS[stepIndex - 1]!.id);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function handlePublish() {
    setIsLoading(true);
    try {
      if (draft) {
        onPublish?.(draft);
      }
    } finally {
      setIsLoading(false);
    }
  }

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <Card className="p-0">
        <div className="h-1 w-full bg-slate-200">
          <div
            className="h-full bg-teal-600 transition-all"
            style={{ width: `${((currentStepIndex + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </Card>

      {/* Steps indicator */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {STEPS.map((step, index) => (
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
        <h1 className="text-2xl font-bold text-slate-950">{STEPS[currentStepIndex]?.label}</h1>
        <p className="mt-1 text-slate-600">{STEPS[currentStepIndex]?.description}</p>
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

        {currentStep === "metadata" && (
          <Card className="p-6">
            <p className="text-slate-600">
              Metadata step coming in Phase 18. For now, continue to the next step.
            </p>
            <div className="mt-4 flex gap-2">
              <Button onClick={handlePrev} variant="secondary" type="button">
                ← Back
              </Button>
              <Button onClick={handleNext} type="button">
                Continue to integration →
              </Button>
            </div>
          </Card>
        )}

        {currentStep === "snippets" && (
          <Card className="p-6">
            <p className="text-slate-600">
              Integration snippets coming in Phase 19. For now, continue to publish.
            </p>
            <div className="mt-4 flex gap-2">
              <Button onClick={handlePrev} variant="secondary" type="button">
                ← Back
              </Button>
              <Button onClick={handleNext} type="button">
                Continue to publish →
              </Button>
            </div>
          </Card>
        )}

        {currentStep === "publish" && draft && (
          <Card className="space-y-6 p-6">
            <div className="space-y-4">
              <div className="rounded-md bg-blue-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-900">Ready to publish</p>
                    <p className="mt-1 text-sm text-blue-800">
                      Your resource draft is complete. Publishing will validate it against the backend
                      and make it available in the catalog.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 border-t border-slate-200 pt-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-slate-500">Resource name</p>
                    <p className="font-medium text-slate-950">{draft.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Type</p>
                    <p className="font-medium text-slate-950">{draft.type === "http" ? "HTTP API" : "MCP Tool"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Endpoint</p>
                    <p className="break-all font-medium text-slate-950">{draft.url}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Route template</p>
                    <p className="break-all font-medium text-slate-950">{draft.routeTemplate}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 border-t border-slate-200 pt-6">
              <Button onClick={handlePrev} variant="secondary" type="button">
                <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                Back
              </Button>
              <Button onClick={handlePublish} disabled={isLoading} type="button">
                Publish resource
              </Button>
            </div>
          </Card>
        )}
      </div>

      {/* Footer navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 pt-6">
        <Button onClick={onCancel} variant="secondary" type="button">
          Save and exit
        </Button>
        <p className="text-xs text-slate-500">
          Step {currentStepIndex + 1} of {STEPS.length}
        </p>
      </div>
    </div>
  );
}
