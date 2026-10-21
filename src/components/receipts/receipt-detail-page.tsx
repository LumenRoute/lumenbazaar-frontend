"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";


import { ErrorState, LoadingState } from "@/components/ui/surfaces";
import { apiClient } from "@/services/api";
import { normalizeUiError } from "@/services/ui-state";

import { ReceiptDetailSummary } from "./receipt-detail-summary";

export function ReceiptDetailPage({ receiptId }: { receiptId: string }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { data, error, isLoading, refetch } = useQuery({
    queryFn: () => apiClient.getReceipt(receiptId),
    queryKey: ["receipt", receiptId]
  });

  // Move focus to the receipt heading once data arrives so keyboard and
  // screen-reader users are oriented without losing context after the async
  // transition from loading to content.
  useEffect(() => {
    if (data !== undefined) {
      headingRef.current?.focus();
    }
  }, [data]);

  if (isLoading) {
    return <LoadingState label="Loading receipt details" />;
  }

  if (error !== null) {
    const state = normalizeUiError(error, {
      code: "RECEIPT_UNAVAILABLE",
      description: "The receipt could not be retrieved from the backend. Please verify the receipt ID and try again.",
      title: "Receipt unavailable"
    });

    return (
      <div
        aria-live="assertive"
        aria-relevant="additions text"
        role="alert"
      >
        <ErrorState
          code={state.code}
          description={state.description}
          onRetry={() => void refetch()}
          requestId={state.requestId}
          title={state.title}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div
        aria-live="polite"
        aria-relevant="additions text"
        role="status"
      >
        <ReceiptDetailSummary headingRef={headingRef} receipt={data} />
      </div>
    </div>
  );
}
