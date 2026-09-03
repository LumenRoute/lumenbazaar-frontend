"use client";

import { CheckCircle2, ClipboardCheck, Globe2, ShieldAlert } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import {
  failureForVerification,
  requestDomainChallenge,
  submitDomainVerification,
  type DomainVerificationFailure,
  type DomainVerificationMethod
} from "@/services/domain-verification";
import type { VerifyDomainResult } from "@/services/api/schemas";

type SellerDomainVerifierProps = {
  domain: string;
  sellerId: string;
};

export function SellerDomainVerifier({ domain, sellerId }: SellerDomainVerifierProps) {
  const [method, setMethod] = useState<DomainVerificationMethod>("well-known");
  const [challenge, setChallenge] = useState<VerifyDomainResult | null>(null);
  const [evidence, setEvidence] = useState("");
  const [failure, setFailure] = useState<DomainVerificationFailure | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestChallenge() {
    setLoading(true);
    setFailure(null);
    const result = await requestDomainChallenge(sellerId, method);
    setChallenge(result);
    setEvidence(result.challenge);
    setLoading(false);
  }

  async function submitEvidence() {
    setLoading(true);
    const result = await submitDomainVerification(sellerId, evidence, method);
    setChallenge(result);
    setFailure(failureForVerification(result));
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Globe2 aria-hidden="true" className="h-5 w-5 text-teal-700" />
            <h2 className="text-lg font-semibold text-slate-950">Domain verification</h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Prove control of {domain} before publishing trusted catalog metadata.
          </p>
        </div>
        <Badge tone={challenge?.verified ? "success" : "warning"}>
          {challenge?.verified ? "Verified" : "Unverified"}
        </Badge>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[220px_auto]">
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Method</span>
            <select
              className="min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              onChange={(event) => setMethod(event.target.value as DomainVerificationMethod)}
              value={method}
            >
              <option value="well-known">Well-known file</option>
              <option value="dns">DNS TXT</option>
            </select>
          </label>
          <div className="flex items-end">
            <Button disabled={loading} onClick={() => void requestChallenge()} type="button">
              <ClipboardCheck aria-hidden="true" className="h-4 w-4" />
              Request challenge
            </Button>
          </div>
        </div>

        {challenge ? (
          <div className="space-y-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              {method === "well-known" ? (
                <p>
                  Publish a file at{" "}
                  <span className="break-all font-medium text-slate-950">
                    https://{challenge.domain}/.well-known/lumenbazaar
                  </span>{" "}
                  containing the challenge value.
                </p>
              ) : (
                <p>
                  Add a TXT record for{" "}
                  <span className="break-all font-medium text-slate-950">
                    _lumenbazaar.{challenge.domain}
                  </span>{" "}
                  containing the challenge value.
                </p>
              )}
              <pre className="mt-3 overflow-auto rounded-md bg-slate-950 p-3 text-xs text-white">
                {challenge.challenge}
              </pre>
            </div>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Evidence</span>
              <textarea
                className="min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                onChange={(event) => setEvidence(event.target.value)}
                value={evidence}
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <Button disabled={loading} onClick={() => void submitEvidence()} type="button">
                <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                Submit verification
              </Button>
              {failure ? (
                <Badge tone="danger">
                  <ShieldAlert aria-hidden="true" className="h-3.5 w-3.5" />
                  {failure.code}
                </Badge>
              ) : null}
              {challenge.verified ? <Badge tone="success">Domain verified</Badge> : null}
            </div>

            {failure ? <p className="text-sm text-red-700">{failure.message}</p> : null}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
