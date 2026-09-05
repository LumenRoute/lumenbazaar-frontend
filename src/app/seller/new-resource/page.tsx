"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { ResourceWizard } from "@/components/seller/resource-wizard";
import { loadSellerDashboard } from "@/services/seller-dashboard";
import { clearDraftFromStorage, type ResourceDraft } from "@/services/resource-creation";

export default function NewResourcePage() {
  const router = useRouter();
  const sellerId = loadSellerDashboard().seller.id;

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

  return (
    <div className="mx-auto max-w-2xl py-8">
      <ResourceWizard sellerId={sellerId} onCancel={handleCancel} onPublish={handlePublish} />
    </div>
  );
}
