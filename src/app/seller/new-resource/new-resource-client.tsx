"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { ResourceWizard } from "@/components/seller/resource-wizard";
import { ErrorState } from "@/components/ui/surfaces";
import { isDemoMode, loadRuntimeConfig } from "@/config/runtime";
import { loadSellerDashboard } from "@/services/seller-dashboard";
import { clearDraftFromStorage, type ResourceDraft } from "@/services/resource-creation";
import { clearEditDraft } from "@/services/resource-edit";

type NewResourceClientProps = {
  resourceId?: string;
};

export function NewResourceClient({ resourceId }: NewResourceClientProps) {
  const router = useRouter();
  const mode = loadRuntimeConfig().environment;
  const demo = isDemoMode(mode);
  const sellerId = demo ? loadSellerDashboard(undefined, mode).seller.id : "";
  const editing = resourceId !== undefined;

  const handleCancel = useCallback(() => {
    router.push("/seller");
  }, [router]);

  const handlePublish = useCallback(
    async (draft: ResourceDraft) => {
      void draft;
      if (resourceId === undefined) {
        clearDraftFromStorage();
      } else {
        clearEditDraft(resourceId);
      }
      router.push("/seller/resources");
    },
    [resourceId, router]
  );

  if (!demo) {
    return (
      <div className="mx-auto max-w-2xl py-8">
        <ErrorState
          code="BACKEND_UNAVAILABLE"
          description={
            editing
              ? "Resource editing is disabled until the backend exposes the required authenticated version workflow."
              : "Resource publication is disabled until the backend exposes the required authenticated seller workflow."
          }
          title={editing ? "Resource editing unavailable" : "Resource creation unavailable"}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl py-8">
      <ResourceWizard
        sellerId={sellerId}
        onCancel={handleCancel}
        onPublish={handlePublish}
        {...(resourceId === undefined ? {} : { resourceId })}
      />
    </div>
  );
}
