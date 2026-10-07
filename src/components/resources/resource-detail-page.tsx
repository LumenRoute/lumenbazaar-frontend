"use client";

import { useQuery } from "@tanstack/react-query";

import { ErrorState, LoadingState } from "@/components/ui/surfaces";
import { loadResourceDetail } from "@/services/resource-detail";
import { normalizeUiError } from "@/services/ui-state";

import { ResourceDetailSummary } from "./resource-detail-summary";
import { PaymentChallengePanel } from "./payment-challenge-panel";
import { PaymentRequirementViewer } from "./payment-requirement-viewer";
import { ResourceSchemaViewer } from "./resource-schema-viewer";

export function ResourceDetailPage({ resourceId }: { resourceId: string }) {
  const { data, error, isLoading, refetch } = useQuery({
    queryFn: () => loadResourceDetail(resourceId),
    queryKey: ["resource-detail", resourceId]
  });

  if (isLoading) {
    return <LoadingState label="Loading resource detail" />;
  }

  if (data === undefined || error !== null) {
    const state = normalizeUiError(error, {
      code: "RESOURCE_UNAVAILABLE",
      description: "The resource detail could not be verified against the configured backend.",
      title: "Resource unavailable"
    });

    return (
      <ErrorState
        code={state.code}
        description={state.description}
        onRetry={() => void refetch()}
        requestId={state.requestId}
        title={state.title}
      />
    );
  }

  return (
    <div className="space-y-5">
      <ResourceDetailSummary {...data} />
      <PaymentRequirementViewer requirement={data.requirement} />
      <PaymentChallengePanel resource={data.resource} source={data.source} />
      <ResourceSchemaViewer
        inputSchema={data.resource.inputSchema}
        outputSchema={data.resource.outputSchema}
      />
    </div>
  );
}
