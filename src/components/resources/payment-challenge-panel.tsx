"use client";

import { ExternalLink, ShieldCheck, WalletCards } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { loadRuntimeConfig } from "@/config/runtime";
import { apiClient } from "@/services/api/client";
import type { Resource } from "@/services/api/schemas";
import {
  AuthorizationError,
  authorizePaymentChallenge,
  type SignedPaymentAuthorization
} from "@/services/x402/authorization";
import {
  ChallengeError,
  expectedTermsForResource,
  requestPaymentChallenge,
  type ValidatedPaymentChallenge
} from "@/services/x402/challenge";
import {
  paidFlowCoordinator,
  paidFlowStateLabels,
  type PaidFlowOutcome,
  type PaidFlowState
} from "@/services/x402/paid-flow";
import { explorerTransactionUrl } from "@/services/payments";

type PaymentChallengePanelProps = {
  resource: Resource;
  source: "api" | "demo";
};

export function PaymentChallengePanel({ resource, source }: PaymentChallengePanelProps) {
  const [challenge, setChallenge] = useState<ValidatedPaymentChallenge>();
  const [authorization, setAuthorization] = useState<SignedPaymentAuthorization>();
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [flowState, setFlowState] = useState<PaidFlowState>();
  const [outcome, setOutcome] = useState<PaidFlowOutcome>();
  const fingerprint = useRef<string | undefined>(undefined);
  const paymentLocked = outcome?.state === "pending" || outcome?.state === "indeterminate";

  useEffect(() => {
    if (source !== "api") return;
    void paidFlowCoordinator.recover({ resourceId: resource.id }).then((recovered) => {
      if (recovered === undefined) return;
      setOutcome(recovered);
      setFlowState(recovered.state);
    });
  }, [resource.id, source]);

  async function requestTerms() {
    setError(undefined);
    setAuthorization(undefined);
    setFlowState(undefined);
    setOutcome(undefined);
    setIsLoading(true);
    try {
      const supported = await apiClient.getSupported();
      const expected = expectedTermsForResource(
        resource,
        supported,
        loadRuntimeConfig().defaultNetwork
      );
      const next = await requestPaymentChallenge(
        {
          headers: [["Accept", "application/json"]],
          method: "GET",
          url: resource.url
        },
        expected,
        { previousFingerprint: fingerprint.current }
      );
      fingerprint.current = next.fingerprint;
      setChallenge(next);
    } catch (caught) {
      setChallenge(undefined);
      setError(
        caught instanceof ChallengeError
          ? `${caught.code}: ${caught.message}`
          : "CHALLENGE_REQUEST_FAILED: The payment terms could not be verified."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function authorize() {
    if (challenge === undefined) return;
    setError(undefined);
    setAuthorization(undefined);
    setIsSigning(true);
    try {
      setAuthorization(await authorizePaymentChallenge(challenge));
    } catch (caught) {
      setError(
        caught instanceof AuthorizationError
          ? `${caught.code}: ${caught.message}`
          : "AUTHORIZATION_FAILED: The wallet authorization could not be created."
      );
    } finally {
      setIsSigning(false);
    }
  }

  async function submitPaidRequest() {
    if (challenge === undefined || authorization === undefined || paymentLocked) return;
    setError(undefined);
    setIsPaying(true);
    try {
      const result = await paidFlowCoordinator.execute({
        authorization,
        challenge,
        onState: setFlowState,
        resourceId: resource.id
      });
      setOutcome(result);
      setFlowState(result.state);
    } catch {
      setOutcome({
        message: "The paid request ended without a definitive outcome.",
        state: "indeterminate"
      });
      setFlowState("indeterminate");
    } finally {
      setIsPaying(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Endpoint payment challenge</h2>
          <p className="mt-1 text-sm text-slate-600">
            Terms decoded from the resource&apos;s canonical PAYMENT-REQUIRED header.
          </p>
        </div>
        {source === "api" ? (
          <Button
            disabled={isLoading || isPaying || paymentLocked}
            onClick={() => void requestTerms()}
            type="button"
          >
            <ShieldCheck aria-hidden="true" className="h-4 w-4" />
            {isLoading ? "Requesting" : challenge === undefined ? "Request terms" : "Refresh terms"}
          </Button>
        ) : (
          <Badge tone="warning">Unavailable in demo mode</Badge>
        )}
      </CardHeader>
      <CardBody>
        {error !== undefined ? (
          <div
            className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            role="alert"
          >
            {error}
          </div>
        ) : challenge === undefined ? (
          <p className="text-sm leading-6 text-slate-600">
            {source === "api"
              ? "Request the endpoint challenge to verify its current payment terms."
              : "Demo catalog entries do not issue live payment challenges."}
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="success">Validated x402 v2 exact</Badge>
              <span className="text-xs text-slate-500">
                Expires {new Date(challenge.expiresAt).toLocaleString()}
              </span>
            </div>
            <dl className="grid gap-4 text-sm md:grid-cols-2 xl:grid-cols-3">
              <Field label="Network" value={challenge.requirement.network} />
              <Field label="Atomic amount" value={challenge.requirement.amount} />
              <Field label="Asset contract" value={challenge.requirement.asset} wrap />
              <Field label="Recipient" value={challenge.requirement.payTo} wrap />
              <Field label="Resource" value={challenge.challenge.resource.url} wrap />
              <Field
                label="Authorization window"
                value={`${challenge.requirement.maxTimeoutSeconds} seconds`}
              />
            </dl>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
              {authorization === undefined ? (
                <span className="text-sm text-slate-600">
                  Authorize with a Freighter payer account.
                </span>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="success">Payment authorization ready</Badge>
                  <span className="break-all text-xs text-slate-500">{authorization.account}</span>
                </div>
              )}
              {authorization === undefined ? (
                <Button disabled={isSigning} onClick={() => void authorize()} type="button">
                  <WalletCards aria-hidden="true" className="h-4 w-4" />
                  {isSigning ? "Authorizing" : "Authorize payment"}
                </Button>
              ) : (
                <Button
                  disabled={isPaying || outcome !== undefined}
                  onClick={() => void submitPaidRequest()}
                  type="button"
                >
                  <ShieldCheck aria-hidden="true" className="h-4 w-4" />
                  {isPaying ? "Submitting" : "Submit paid request"}
                </Button>
              )}
            </div>
          </div>
        )}
        {flowState !== undefined ? (
          <div aria-live="polite" className="mt-4 border-t border-slate-200 pt-4">
            <Badge tone={flowTone(flowState)}>{paidFlowStateLabels[flowState]}</Badge>
          </div>
        ) : null}
        {outcome !== undefined ? <PaymentOutcome outcome={outcome} /> : null}
      </CardBody>
    </Card>
  );
}

function PaymentOutcome({ outcome }: { outcome: PaidFlowOutcome }) {
  const transactionHash = outcome.transactionHash;
  const network = outcome.receipt?.network ?? outcome.settlement?.network;

  return (
    <div className="space-y-4 border-t border-slate-200 pt-4">
      <p className="text-sm leading-6 text-slate-700">{outcome.message}</p>
      {outcome.receipt !== undefined ? (
        <dl className="grid gap-4 text-sm md:grid-cols-2 xl:grid-cols-3">
          <Field label="Receipt" value={outcome.receipt.id} wrap />
          <Field label="Receipt status" value={outcome.receipt.status} />
          <Field label="Ledger" value={String(outcome.receipt.ledger ?? "Pending")} />
        </dl>
      ) : null}
      {transactionHash !== undefined && network !== undefined ? (
        <a
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50"
          href={explorerTransactionUrl(network, transactionHash)}
          rel="noreferrer"
          target="_blank"
        >
          <ExternalLink aria-hidden="true" className="h-4 w-4" />
          Stellar transaction
        </a>
      ) : null}
      {outcome.paidResponse !== undefined ? (
        <div>
          <h3 className="text-sm font-semibold text-slate-950">Paid response</h3>
          <pre className="mt-2 max-h-80 overflow-auto rounded-md bg-slate-950 p-4 text-xs leading-5 text-white">
            {formatPaidResponse(outcome.paidResponse.body)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

function flowTone(state: PaidFlowState) {
  if (state === "confirmed") return "success" as const;
  if (state === "rejected") return "danger" as const;
  if (state === "pending" || state === "indeterminate") return "warning" as const;
  return "info" as const;
}

function formatPaidResponse(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
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
