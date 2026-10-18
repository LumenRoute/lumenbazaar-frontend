"use client";

import { CheckCircle2, ClipboardCheck, Globe2, Loader, RefreshCw, ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import {
  challengeSecondsRemaining,
  failureForVerification,
  isChallengeExpired,
  pollDomainVerification,
  requestDomainChallenge,
  requestReplacementChallenge,
  type DomainChallenge,
  type DomainVerificationFailure,
  type DomainVerificationMethod,
  type DomainVerificationPollResult
} from "@/services/domain-verification";

type SellerDomainVerifierProps = {
  domain: string;
  sellerId: string;
};

const POLL_SCHEDULE = {
  initialDelayMs: 1_000,
  maxAttempts: 4,
  maxDelayMs: 8_000,
  maxElapsedMs: 30_000
} as const;

export function SellerDomainVerifier({ domain, sellerId }: SellerDomainVerifierProps) {
  const [method, setMethod] = useState<DomainVerificationMethod>("well-known");
  const [challenge, setChallenge] = useState<DomainChallenge | null>(null);
  const [evidence, setEvidence] = useState("");
  const [failure, setFailure] = useState<DomainVerificationFailure | null>(null);
  const [loading, setLoading] = useState(false);
  const [pollStatus, setPollStatus] = useState<DomainVerificationPollResult["status"] | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [clock, setClock] = useState(() => Date.now());
  const activeCheck = useRef<AbortController | null>(null);
  const secondsRemaining = challenge === null ? null : challengeSecondsRemaining(challenge, clock);
  const expired = challenge !== null && secondsRemaining === 0;

  // Abort in-flight verification when the seller navigates away.
  useEffect(() => () => activeCheck.current?.abort(), []);

  // Tick a clock while a challenge is live so expiry stays accurate.
  useEffect(() => {
    if (challenge === null) return;
    const id = setInterval(() => setClock(Date.now()), 1_000);

    return () => clearInterval(id);
  }, [challenge]);

  function cancelActiveCheck() {
    activeCheck.current?.abort();
    activeCheck.current = null;
  }

  async function requestChallenge() {
    cancelActiveCheck();
    setLoading(true);
    setFailure(null);
    setPollStatus(null);
    setAttempts(0);
    try {
      setChallenge(await requestDomainChallenge(sellerId, method));
      setEvidence("");
      setClock(Date.now());
    } finally {
      setLoading(false);
    }
  }

  async function replaceChallenge() {
    // Replacement invalidates all state bound to the previous challenge token.
    cancelActiveCheck();
    setLoading(true);
    setFailure(null);
    setPollStatus(null);
    setAttempts(0);
    setEvidence("");
    try {
      setChallenge(await requestReplacementChallenge({ method, sellerId }));
      setClock(Date.now());
    } finally {
      setLoading(false);
    }
  }

  async function submitEvidence() {
    if (challenge === null) return;
    if (isChallengeExpired(challenge)) {
      setFailure({
        code: "DOMAIN_CHALLENGE_EXPIRED",
        message: "This challenge expired. Request a replacement challenge before retrying.",
        retryable: false
      });
      setPollStatus("expired");
      return;
    }

    cancelActiveCheck();
    const controller = new AbortController();
    activeCheck.current = controller;
    setLoading(true);
    setFailure(null);
    setAttempts(0);
    try {
      const result = await pollDomainVerification({
        challenge,
        evidence,
        method,
        schedule: POLL_SCHEDULE,
        sellerId,
        signal: controller.signal
      });
      if (controller.signal.aborted) {
        setPollStatus("cancelled");
        return;
      }

      setAttempts(result.attempts);
      setPollStatus(result.status);
      setFailure(result.failure);
      if (result.result !== null) {
        setChallenge({ ...challenge, ...result.result });
        if (result.result.verified) {
          setFailure(null);
        }
      }
    } catch {
      if (!controller.signal.aborted) {
        setFailure(failureForVerification({ ...challenge, verified: false }));
        setPollStatus("failed");
      }
    } finally {
      if (activeCheck.current === controller) activeCheck.current = null;
      setLoading(false);
    }
  }

  async function retryVerification() {
    if (challenge === null || expired) return;
    await submitEvidence();
  }

  function stopChecking() {
    cancelActiveCheck();
    setPollStatus("cancelled");
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
        <Badge tone={challenge?.verified ? "success" : expired ? "danger" : "warning"}>
          {challenge?.verified ? "Verified" : expired ? "Challenge expired" : "Unverified"}
        </Badge>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[220px_auto]">
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Method</span>
            <select
              className="min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              disabled={loading}
              onChange={(event) => setMethod(event.target.value as DomainVerificationMethod)}
              value={method}
            >
              <option value="well-known">Well-known file</option>
              <option value="dns">DNS TXT</option>
            </select>
          </label>
          <div className="flex items-end gap-2">
            <Button disabled={loading} onClick={() => void requestChallenge()} type="button">
              <ClipboardCheck aria-hidden="true" className="h-4 w-4" />
              Request challenge
            </Button>
            {challenge !== null ? (
              <Button
                disabled={loading}
                onClick={() => void replaceChallenge()}
                type="button"
                variant="secondary"
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                Replacement challenge
              </Button>
            ) : null}
          </div>
        </div>

        {challenge ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">
                Issued {new Date(challenge.issuedAt).toLocaleTimeString()}
              </Badge>
              <span
                aria-live="polite"
                className={
                  secondsRemaining !== null && secondsRemaining <= 60
                    ? "text-xs font-medium text-amber-700"
                    : "text-xs text-slate-500"
                }
              >
                {expired
                  ? "Challenge expired"
                  : secondsRemaining === null
                    ? "Challenge expiry pending"
                    : `Expires in ${formatDuration(secondsRemaining)}`}
              </span>
            </div>

            {expired ? (
              <div
                className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                role="alert"
              >
                This challenge expired at {new Date(challenge.expiresAt).toLocaleTimeString()}. The
                previous token is no longer accepted; request a replacement challenge to continue.
              </div>
            ) : null}

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
                <div className="space-y-2">
                  <p>
                    Add a TXT record for{" "}
                    <span className="break-all font-medium text-slate-950">
                      _lumenbazaar.{challenge.domain}
                    </span>{" "}
                    containing the challenge value.
                  </p>
                  <p className="text-xs text-slate-500">
                    DNS changes can take up to 48 hours to propagate. Retrying the same challenge is
                    safe and does not invalidate it.
                  </p>
                </div>
              )}
              <pre className="mt-3 overflow-auto rounded-md bg-slate-950 p-3 text-xs text-white">
                {challenge.challenge}
              </pre>
            </div>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Evidence</span>
              <textarea
                className="min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                disabled={loading}
                onChange={(event) => setEvidence(event.target.value)}
                value={evidence}
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                disabled={loading || expired || evidence.trim().length === 0}
                onClick={() => void submitEvidence()}
                type="button"
              >
                {loading ? (
                  <Loader aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                )}
                {loading ? "Checking verification" : "Submit verification"}
              </Button>
              {loading ? (
                <Button onClick={stopChecking} type="button" variant="secondary">
                  Stop checking
                </Button>
              ) : null}
              {!loading && pollStatus !== null && !challenge.verified ? (
                <Button
                  disabled={expired}
                  onClick={() => void retryVerification()}
                  type="button"
                  variant="secondary"
                >
                  Retry verification
                </Button>
              ) : null}
              {challenge.verified ? <Badge tone="success">Domain verified</Badge> : null}
              {failure ? (
                <Badge tone={failure.retryable ? "warning" : "danger"}>
                  <ShieldAlert aria-hidden="true" className="h-3.5 w-3.5" />
                  {failure.code}
                </Badge>
              ) : null}
            </div>

            {failure ? (
              <p className="text-sm text-red-700" role="alert">
                {failure.message}
              </p>
            ) : null}

            {pollStatus !== null && !challenge.verified ? (
              <p className="text-xs text-slate-500" aria-live="polite">
                {pollSummary(pollStatus, attempts)}
              </p>
            ) : null}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

function pollSummary(status: DomainVerificationPollResult["status"], attempts: number) {
  const checks = `${attempts} ${attempts === 1 ? "check" : "checks"}`;

  switch (status) {
    case "verified":
      return "Verification succeeded.";
    case "expired":
      return "Polling stopped because the challenge expired.";
    case "cancelled":
      return `Polling stopped after ${checks}.`;
    case "failed":
      return `Polling stopped after ${checks} because the backend rejected the request.`;
    case "exhausted":
      return `Polling stopped after ${checks}; the bounded retry limit was reached.`;
  }
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;

  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}
