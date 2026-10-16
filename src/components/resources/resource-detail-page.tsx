"use client";

import { useQuery } from "@tanstack/react-query";

import { ErrorState, LoadingState } from "@/components/ui/surfaces";
import { loadResourceDetail, type ResourceDetailError } from "@/services/resource-detail";
import { normalizeUiError } from "@/services/ui-state";

import { ResourceDetailSummary } from "./resource-detail-summary";
import { PaymentChallengePanel } from "./payment-challenge-panel";
import { PaymentRequirementViewer } from "./payment-requirement-viewer";
import { ResourceSchemaViewer } from "./resource-schema-viewer";

function isResourceDetailError(error: unknown): error is ResourceDetailError {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    ("code" === "NOT_FOUND" ||
      "code" === "SERVICE_UNAVAILABLE" ||
      "code" === "INVALID_RESPONSE" ||
      "code" === "UNKNOWN_ERROR")
  );
}

function getErrorState(error: unknown) {
  if (isResourceDetailError(error)) {
    switch (error.code) {
      case "NOT_FOUND":
        return {
          code: "NOT_FOUND",
          description: "This resource does not exist or has been removed.",
          title: "Resource not found",
          requestId: undefined
        };

      case "SERVICE_UNAVAILABLE":
        return {
          code: "SERVICE_UNAVAILABLE",
          description:
            "The backend service is temporarily unavailable. Please try again in a few moments.",
          title: "Service unavailable",
          requestId: error.requestId
        };

      case "INVALID_RESPONSE":
        return {
          code: "INVALID_RESPONSE",
          description: "The backend returned an invalid response. Please try again.",
          title: "Invalid response",
          requestId: error.requestId
        };

      case "UNKNOWN_ERROR":
      default:
        return {
          code: "UNKNOWN_ERROR",
          description: "The resource detail could not be loaded. Please try again.",
          title: "Unable to load resource",
          requestId: error.requestId
        };
    }
  }

  // Fallback for non-typed errors
  const state = normalizeUiError(error, {
    code: "RESOURCE_UNAVAILABLE",
    description: "The resource detail could not be verified against the configured backend.",
    title: "Resource unavailable"
  });

  return state;
}

export function ResourceDetailPage({ resourceId }: { resourceId: string }) {
  const { data, error, isLoading, refetch } = useQuery({
    queryFn: () => loadResourceDetail(resourceId),
    queryKey: ["resource-detail", resourceId]
  });

  if (isLoading) {
    return <LoadingState label="Loading resource detail" />;
  }

  if (data === undefined || error !== null) {
    const state = getErrorState(error);

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
