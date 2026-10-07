"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { ResourceWizard } from "@/components/seller/resource-wizard";
import { ErrorState } from "@/components/ui/surfaces";
import { isDemoMode, loadRuntimeConfig } from "@/config/runtime";
import { loadSellerDashboard } from "@/services/seller-dashboard";
import { clearDraftFromStorage, type ResourceDraft } from "@/services/resource-creation";

export default function NewResourcePage() {
  const router = useRouter();
  const mode = loadRuntimeConfig().environment;
  const demo = isDemoMode(mode);
  const sellerId = demo ? loadSellerDashboard(undefined, mode).seller.id : "";

  const handleCancel = useCallback(() => {
    router.push("/seller");
  }, [router]);

  const handlePublish = useCallback(
    async (draft: ResourceDraft) => {
      void draft;
      clearDraftFromStorage();
      router.push("/seller/resources");
    },
    [router]
  );

  if (!demo) {
    return (
      <div className="mx-auto max-w-2xl py-8">
        <ErrorState
          code="BACKEND_UNAVAILABLE"
          description="Resource publication is disabled until the backend exposes the required authenticated seller workflow."
          title="Resource creation unavailable"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl py-8">
      <ResourceWizard sellerId={sellerId} onCancel={handleCancel} onPublish={handlePublish} />
    </div>
  );
}
