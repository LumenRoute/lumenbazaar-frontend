"use client";

import {
  AlertTriangle,
  ExternalLink,
  Play,
  ReceiptText,
  Send,
  ShieldCheck,
  Wallet
} from "lucide-react";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { demoResources } from "@/fixtures/lumenbazaar";
import { apiClient } from "@/services/api/client";
import type {
  PaymentPayload,
  PaymentVerification,
  Resource,
  Settlement
} from "@/services/api/schemas";
import {
  buildPaymentRequiredPreview,
  buildPlaygroundPaymentRequest,
  buildSampleRequest,
  simulateSettlement,
  simulateVerification,
  type PaymentRequiredPreview,
  type PlaygroundAuthorizationMode
} from "@/services/playground";
import { explorerTransactionUrl, shortHash } from "@/services/payments";
import { normalizeUiError, redactSensitivePaymentData } from "@/services/ui-state";

export function PaymentPlayground() {
  const [selectedResourceId, setSelectedResourceId] = useState(demoResources[0]?.id ?? "");
  const [mode, setMode] = useState<PlaygroundAuthorizationMode>("simulation");
  const [preview, setPreview] = useState<PaymentRequiredPreview | null>(null);
  const [paymentRequest, setPaymentRequest] = useState<PaymentPayload | null>(null);
  const [verification, setVerification] = useState<PaymentVerification | null>(null);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [busy, setBusy] = useState<"verify" | "settle" | null>(null);
  const resource = useMemo<Resource>(
    () => demoResources.find((item) => item.id === selectedResourceId) ?? demoResources[0]!,
    [selectedResourceId]
  );
  const sampleRequest = useMemo(
    () => (resource ? buildSampleRequest(resource.inputSchema) : {}),
    [resource]
  );

  function prepare(resource: Resource, authorizationMode = mode) {
    const nextRequest = buildPlaygroundPaymentRequest(resource, { authorizationMode });

    setPreview(buildPaymentRequiredPreview(resource));
    setPaymentRequest(nextRequest);
    setVerification(null);
    setSettlement(null);
    setError(null);
    return nextRequest;
  }

  function runSimulatedVerify() {
    const request = paymentRequest ?? prepare(resource);

    setVerification(simulateVerification(request));
    setSettlement(null);
    setError(null);
  }

  async function runBackendVerify() {
    const request = paymentRequest ?? prepare(resource);

    setBusy("verify");
    setError(null);
    setSettlement(null);

    try {
      setVerification(await apiClient.verifyPayment(request));
    } catch (caught) {
      setVerification(null);
      setError(normalizePlaygroundError(caught));
    } finally {
      setBusy(null);
    }
  }

  function runSimulatedSettle() {
    const request = paymentRequest ?? prepare(resource);
    const currentVerification = verification ?? simulateVerification(request);

    setVerification(currentVerification);
    setSettlement(simulateSettlement(request, currentVerification));
    setError(null);
  }

  async function runBackendSettle() {
    const request = paymentRequest ?? prepare(resource);
    const currentVerification = verification;

    if (currentVerification === null) {
      setError({
        code: "VERIFY_REQUIRED",
        message: "Verification must succeed before settlement."
      });
      return;
    }

    setBusy("settle");
    setError(null);

    try {
      setSettlement(
        await apiClient.settlePayment({
          ...request,
          paymentAttemptId: currentVerification.paymentAttemptId
        })
      );
    } catch (caught) {
      setSettlement(null);
      setError(normalizePlaygroundError(caught));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        description="Select a resource, inspect exact x402 payment requirements, verify a payload, and inspect settlement evidence."
        title="Payment playground"
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-950">Resource</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Paid resource</span>
                <select
                  className="min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                  onChange={(event) => {
                    setSelectedResourceId(event.target.value);
                    setPreview(null);
                    setPaymentRequest(null);
                    setVerification(null);
                    setSettlement(null);
                    setError(null);
                  }}
                  value={resource.id}
                >
                  {demoResources.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 md:grid-cols-3">
                <Fact label="Network" value={resource.network} />
                <Fact label="Amount" value={`${resource.amount} ${resource.assetCode}`} />
                <Fact label="Type" value={resource.type.toUpperCase()} />
              </div>
              <pre className="max-h-72 overflow-auto rounded-md bg-slate-950 p-4 text-xs text-slate-100">
                {JSON.stringify(sampleRequest, null, 2)}
              </pre>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-950">Authorization</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Authorization mode">
                <Button
                  onClick={() => {
                    setMode("simulation");
                    prepare(resource, "simulation");
                  }}
                  type="button"
                  variant={mode === "simulation" ? "primary" : "secondary"}
                >
                  <Play aria-hidden="true" className="h-4 w-4" />
                  Simulation
                </Button>
                <Button
                  onClick={() => {
                    setMode("wallet");
                    prepare(resource, "wallet");
                  }}
                  type="button"
                  variant={mode === "wallet" ? "primary" : "secondary"}
                >
                  <Wallet aria-hidden="true" className="h-4 w-4" />
                  Wallet draft
                </Button>
                <Button onClick={() => prepare(resource)} type="button" variant="secondary">
                  402
                </Button>
              </div>

              {preview ? (
                <pre className="max-h-64 overflow-auto rounded-md bg-slate-950 p-4 text-xs text-slate-100">
                  {JSON.stringify(preview, null, 2)}
                </pre>
              ) : (
                <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                  No payment requirement generated yet.
                </p>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-950">Flow</h2>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <Button onClick={runSimulatedVerify} type="button" variant="secondary">
                  <ShieldCheck aria-hidden="true" className="h-4 w-4" />
                  Simulate verify
                </Button>
                <Button
                  disabled={busy === "verify"}
                  onClick={() => void runBackendVerify()}
                  type="button"
                >
                  <Send aria-hidden="true" className="h-4 w-4" />
                  {busy === "verify" ? "Verifying" : "Verify API"}
                </Button>
                <Button onClick={runSimulatedSettle} type="button" variant="secondary">
                  <ReceiptText aria-hidden="true" className="h-4 w-4" />
                  Simulate settle
                </Button>
                <Button
                  disabled={busy === "settle" || verification === null}
                  onClick={() => void runBackendSettle()}
                  type="button"
                >
                  <ReceiptText aria-hidden="true" className="h-4 w-4" />
                  {busy === "settle" ? "Settling" : "Settle API"}
                </Button>
              </div>

              {verification ? (
                <ResultPanel
                  label="Verification"
                  rows={[
                    ["Status", verification.status],
                    ["Attempt", verification.paymentAttemptId],
                    ["Hash", shortHash(verification.paymentHash)],
                    ["Adapter", verification.adapter]
                  ]}
                  tone="success"
                />
              ) : null}

              {settlement ? (
                <ResultPanel
                  label="Settlement"
                  rows={[
                    ["Status", settlement.status],
                    ["Receipt", settlement.receiptId],
                    ["Ledger", String(settlement.ledger)],
                    ["Hash", shortHash(settlement.transactionHash)]
                  ]}
                  tone="success"
                />
              ) : null}

              {settlement?.transactionHash ? (
                <a
                  className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50"
                  href={explorerTransactionUrl(settlement.network, settlement.transactionHash)}
                  rel="noreferrer"
                  target="_blank"
                >
                  <ExternalLink aria-hidden="true" className="h-4 w-4" />
                  Stellar transaction
                </a>
              ) : null}

              {error ? (
                <div className="rounded-md border border-red-200 bg-red-50 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 text-red-700" />
                    <div>
                      <Badge tone="danger">{error.code}</Badge>
                      <p className="mt-2 text-sm leading-6 text-red-800">{error.message}</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-950">Payment payload</h2>
            </CardHeader>
            <CardBody>
              <pre className="max-h-[34rem] overflow-auto rounded-md bg-slate-950 p-4 text-xs text-slate-100">
                {JSON.stringify(
                  redactSensitivePaymentData(
                    paymentRequest ?? buildPlaygroundPaymentRequest(resource)
                  ),
                  null,
                  2
                )}
              </pre>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 break-all text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

function ResultPanel({
  label,
  rows,
  tone
}: {
  label: string;
  rows: Array<[string, string]>;
  tone: "success" | "warning" | "danger";
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-950">{label}</p>
        <Badge tone={tone}>complete</Badge>
      </div>
      <dl className="space-y-2">
        {rows.map(([key, value]) => (
          <div className="grid grid-cols-[7rem_1fr] gap-3 text-sm" key={key}>
            <dt className="text-slate-500">{key}</dt>
            <dd className="break-all font-medium text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function normalizePlaygroundError(error: unknown) {
  const state = normalizeUiError(error, {
    code: "REQUEST_FAILED",
    description: "Payment request failed.",
    title: "Payment request failed"
  });

  return {
    code: state.code,
    message: state.description
  };
}
