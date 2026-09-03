"use client";

import { Clipboard, ReceiptText, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { ErrorCode, PaymentRequirement } from "@/services/api/schemas";

import { prettyJson } from "./schema-utils";

type PaymentRequirementViewerProps = {
  failureReasons?: Array<{
    code: ErrorCode | string;
    message: string;
  }>;
  requirement: PaymentRequirement;
};

export function PaymentRequirementViewer({
  failureReasons = [],
  requirement
}: PaymentRequirementViewerProps) {
  const [copied, setCopied] = useState(false);

  async function copyPayload() {
    await navigator.clipboard.writeText(prettyJson(requirement));
    setCopied(true);
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Payment requirement</h2>
          <p className="mt-1 text-sm text-slate-600">
            Exact x402 terms exposed without inspecting raw network logs.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={copyPayload}>
          <Clipboard aria-hidden="true" className="h-4 w-4" />
          {copied ? "Copied" : "Copy JSON"}
        </Button>
      </CardHeader>
      <CardBody className="space-y-5">
        <dl className="grid gap-4 text-sm md:grid-cols-2 xl:grid-cols-4">
          <Field label="x402 version" value={requirement.x402Version} />
          <Field label="Scheme" value={requirement.scheme} />
          <Field label="Network" value={requirement.network} />
          <Field label="Amount" value={`${requirement.amount} ${requirement.assetCode}`} />
          <Field label="Asset issuer" value={requirement.assetIssuer} wrap />
          <Field label="Recipient" value={requirement.payTo} wrap />
          <Field
            label="Expiry"
            value={
              requirement.expiresAtLedger === null
                ? "Backend ledger policy"
                : String(requirement.expiresAtLedger)
            }
          />
          <Field label="Resource" value={requirement.resourceId} wrap />
        </dl>

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2">
              <ReceiptText aria-hidden="true" className="h-4 w-4 text-teal-700" />
              <h3 className="text-sm font-semibold text-slate-950">Extensions</h3>
            </div>
            <pre className="mt-3 max-h-72 overflow-auto text-xs leading-5 text-slate-700">
              {prettyJson(requirement.extensions)}
            </pre>
          </div>

          <div className="rounded-md border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <TriangleAlert aria-hidden="true" className="h-4 w-4 text-amber-700" />
              <h3 className="text-sm font-semibold text-slate-950">Failure reasons</h3>
            </div>
            {failureReasons.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-slate-600">
                No current failure reasons are attached to this requirement.
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {failureReasons.map((failure) => (
                  <Badge key={`${failure.code}:${failure.message}`} tone="danger">
                    {failure.code}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </section>

        <pre className="max-h-96 overflow-auto rounded-md bg-slate-950 p-4 text-xs leading-5 text-white">
          {prettyJson(requirement)}
        </pre>
      </CardBody>
    </Card>
  );
}

function Field({ label, value, wrap = false }: { label: string; value: string; wrap?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-slate-500">{label}</dt>
      <dd
        className={
          wrap ? "mt-1 break-all font-medium text-slate-900" : "mt-1 font-medium text-slate-900"
        }
      >
        {value}
      </dd>
    </div>
  );
}
