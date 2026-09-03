"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { ResourceWizard } from "@/components/seller/resource-wizard";
import { clearDraftFromStorage, type ResourceDraft } from "@/services/resource-creation";

export default function NewResourcePage() {
  const router = useRouter();

  const handleCancel = useCallback(() => {
    router.push("/seller");
  }, [router]);

  const handlePublish = useCallback(
    async (draft: ResourceDraft) => {
      // Phase 20 will implement the actual publish logic
      console.log("Publishing resource draft:", draft);

      // For now, clear the draft and redirect
      clearDraftFromStorage();
      router.push("/seller/resources");
    },
    [router]
  );

  return (
    <div className="mx-auto max-w-2xl py-8">
      <ResourceWizard onCancel={handleCancel} onPublish={handlePublish} />
    </div>
  );
}
