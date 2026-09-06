import { AlertCircle, Inbox, LoaderCircle } from "lucide-react";

import { Button } from "./button";
import { Card, CardBody } from "./card";

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <Card>
      <CardBody className="flex min-h-32 items-center gap-3 text-slate-600">
        <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin text-teal-700" />
        <span>{label}</span>
      </CardBody>
    </Card>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardBody className="flex min-h-32 items-start gap-3">
        <Inbox aria-hidden="true" className="mt-1 h-5 w-5 text-slate-400" />
        <div>
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
        </div>
      </CardBody>
    </Card>
  );
}

export function ErrorState({
  code,
  title,
  description,
  onRetry,
  requestId
}: {
  code?: string;
  title: string;
  description: string;
  onRetry?: () => void;
  requestId?: string;
}) {
  return (
    <Card>
      <CardBody className="flex min-h-32 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertCircle aria-hidden="true" className="mt-1 h-5 w-5 text-red-600" />
          <div>
            <h2 className="text-base font-semibold text-slate-950">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
            {code || requestId ? (
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {code ? (
                  <span className="rounded border border-red-200 bg-red-50 px-2 py-1 font-medium text-red-700">
                    {code}
                  </span>
                ) : null}
                {requestId ? (
                  <span className="break-all rounded border border-slate-200 bg-slate-50 px-2 py-1 font-medium text-slate-600">
                    {requestId}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        {onRetry ? (
          <Button type="button" variant="secondary" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </CardBody>
    </Card>
  );
}
