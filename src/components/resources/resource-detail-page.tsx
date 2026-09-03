"use client";

import { useQuery } from "@tanstack/react-query";

import { ErrorState, LoadingState } from "@/components/ui/surfaces";
import { loadResourceDetail } from "@/services/resource-detail";

import { ResourceDetailSummary } from "./resource-detail-summary";

export function ResourceDetailPage({ resourceId }: { resourceId: string }) {
  const { data, error, isLoading, refetch } = useQuery({
    queryFn: () => loadResourceDetail(resourceId),
    queryKey: ["resource-detail", resourceId]
  });

  if (isLoading) {
    return <LoadingState label="Loading resource detail" />;
  }

  if (data === undefined || error !== null) {
    return (
      <ErrorState
        title="Resource unavailable"
        description="The resource detail could not be loaded from the API or local fixtures."
        onRetry={() => void refetch()}
      />
    );
  }

  return <ResourceDetailSummary {...data} />;
}
