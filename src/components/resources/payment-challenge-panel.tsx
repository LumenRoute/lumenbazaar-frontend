"use client";

import { ShieldCheck, WalletCards } from "lucide-react";
import { useRef, useState } from "react";

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
  const fingerprint = useRef<string | undefined>(undefined);

  async function requestTerms() {
    setError(undefined);
    setAuthorization(undefined);
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
          <Button disabled={isLoading} onClick={() => void requestTerms()} type="button">
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
              <Button
                disabled={isSigning || authorization !== undefined}
                onClick={() => void authorize()}
                type="button"
              >
                <WalletCards aria-hidden="true" className="h-4 w-4" />
                {isSigning ? "Authorizing" : "Authorize payment"}
              </Button>
            </div>
          </div>
        )}
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
