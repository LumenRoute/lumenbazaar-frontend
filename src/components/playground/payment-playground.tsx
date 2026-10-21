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
import { useEffect, useMemo, useRef, useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/surfaces";
import { isDemoMode, loadRuntimeConfig } from "@/config/runtime";
import { demoResources } from "@/fixtures/lumenbazaar";
import { apiClient } from "@/services/api/client";
import {
  paymentFlowStateLabels,
  type PaymentFlowState,
  type PaymentPayload,
  type Resource,
  type Settlement
} from "@/services/api/schemas";
import {
  buildPaymentRequiredPreview,
  buildPlaygroundPaymentRequest,
  buildSampleRequest,
  markSettlementAsLive,
  markVerificationAsLive,
  simulateSettlement,
  simulateVerification,
  type PaymentRequiredPreview,
  type PlaygroundAuthorizationMode,
  type PlaygroundDataMode,
  type PlaygroundSettlement,
  type PlaygroundVerification
} from "@/services/playground";
import { explorerTransactionUrl, shortHash } from "@/services/payments";
import { normalizeUiError, redactSensitivePaymentData } from "@/services/ui-state";
import { checkPaymentPreflight, type PreflightCheckError } from "@/services/stellar/preflight";
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

export function PaymentPlayground() {
  if (!isDemoMode(loadRuntimeConfig().environment)) {
    return (
      <>
        <PageHeader
          description="Select a resource, inspect exact x402 payment requirements, verify a payload, and inspect settlement evidence."
          title="Payment playground"
        />
        <ErrorState
          code="BACKEND_UNAVAILABLE"
          description="The fixture playground is disabled outside explicit demo mode. Live paid-resource handling is enabled only after the x402 v2 challenge flow is available."
          title="Payment playground unavailable"
        />
      </>
    );
  }

  return <DemoPaymentPlayground />;
}

function DemoPaymentPlayground() {
  const [dataMode, setDataMode] = useState<PlaygroundDataMode>("simulation");
  const [authMode, setAuthMode] = useState<PlaygroundAuthorizationMode>("simulation");
  const [selectedResourceId, setSelectedResourceId] = useState(demoResources[0]?.id ?? "");
  const [liveResources, setLiveResources] = useState<Resource[] | null>(null);
  const [apiLoadError, setApiLoadError] = useState<string | null>(null);
  const [loadingLiveResources, setLoadingLiveResources] = useState(false);
  const [preview, setPreview] = useState<PaymentRequiredPreview | null>(null);
  const [paymentRequest, setPaymentRequest] = useState<PaymentPayload | null>(null);
  const [verification, setVerification] = useState<PlaygroundVerification | null>(null);
  const [settlement, setSettlement] = useState<PlaygroundSettlement | null>(null);
  const [error, setError] = useState<{ code: string; message: string; retryable?: boolean } | null>(null);
  const [preflightError, setPreflightError] = useState<PreflightCheckError | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [mode, setMode] = useState<"simulation" | "wallet">("simulation");

  const statusRegionRef = useRef<HTMLDivElement | null>(null);
  const errorRegionRef = useRef<HTMLDivElement | null>(null);
  const preflightErrorRef = useRef<HTMLDivElement | null>(null);
  const paidFlowOutcomeRef = useRef<HTMLDivElement | null>(null);
  const [announcement, setAnnouncement] = useState<string>("");

  // Attempt to load live resources on mount
  useEffect(() => {
    loadLiveResourcesIfAvailable();
  }, []);

  async function loadLiveResourcesIfAvailable() {
    setLoadingLiveResources(true);
    setApiLoadError(null);
    try {
      const resources = await apiClient.listResources();
      setLiveResources(resources.data);
      // Switch to live mode if we successfully loaded resources
      setDataMode("live");
    } catch (caught) {
      const normalized = normalizeUiError(caught, {
        code: "API_UNAVAILABLE",
        description: "Could not reach the live API. Use Simulation mode to work with fixtures.",
        title: "Live API unavailable"
      });
      setApiLoadError(normalized.description);
      // Keep in simulation mode as fallback
      setDataMode("simulation");
    } finally {
      setLoadingLiveResources(false);
    }
  }

  useEffect(() => {
    if (announcement) {
      statusRegionRef.current?.focus();
    }
  }, [announcement]);

  // Get current resources based on mode
  const currentResources = dataMode === "live" && liveResources ? liveResources : demoResources;

  const [challenge, setChallenge] = useState<ValidatedPaymentChallenge | null>(null);
  const [authorization, setAuthorization] = useState<SignedPaymentAuthorization | null>(null);
  const [paidFlowOutcome, setPaidFlowOutcome] = useState<PaidFlowOutcome | null>(null);
  const [paidFlowState, setPaidFlowState] = useState<PaidFlowState | null>(null);
  const resource = useMemo<Resource>(
    () => currentResources.find((item) => item.id === selectedResourceId) ?? currentResources[0]!,
    [selectedResourceId, currentResources]
  );

  useEffect(() => {
    if (error) {
      errorRegionRef.current?.focus();
    }
  }, [error]);

  useEffect(() => {
    // Check for interrupted payment recovery on resource change
    async function checkRecovery() {
      const recovered = await paidFlowCoordinator.recover({ resourceId: resource.id });
      if (recovered !== undefined) {
        setPaidFlowOutcome(recovered);
        setPaidFlowState(recovered.state);
      }
    }
    void checkRecovery();
  }, [resource.id]);
  const sampleRequest = useMemo(
    () => (resource ? buildSampleRequest(resource.inputSchema) : {}),
    [resource]
  );

  function prepare(resource: Resource, authMode: PlaygroundAuthorizationMode = authMode) {
    const nextRequest = buildPlaygroundPaymentRequest(resource, { authorizationMode: authMode });

    setPreview(buildPaymentRequiredPreview(resource));
    setPaymentRequest(nextRequest);
    setVerification(null);
    setSettlement(null);
    setError(null);
    setPreflightError(null);
    setAnnouncement(`Prepared ${resource.name} payment request.`);
    setMode(authMode);
    return nextRequest;
  }

  async function switchDataMode(newMode: PlaygroundDataMode) {
    setDataMode(newMode);
    setApiLoadError(null);

    if (newMode === "live") {
      // Try to load live resources when switching to live
      setLoadingLiveResources(true);
      try {
        const resources = await apiClient.listResources();
        setLiveResources(resources.data);
      } catch (caught) {
        const normalized = normalizeUiError(caught, {
          code: "API_UNAVAILABLE",
          description: "Could not reach the live API.",
          title: "Live API unavailable"
        });
        setApiLoadError(normalized.description);
        // Revert to simulation if load fails
        setDataMode("simulation");
      } finally {
        setLoadingLiveResources(false);
      }
    }

    // Clear verification/settlement state to avoid mixing live and simulated records
    setVerification(null);
    setSettlement(null);
    setError(null);
    setPreflightError(null);
    setPreview(null);
    setPaymentRequest(null);
    setAnnouncement(`Switched to ${newMode === "live" ? "live API" : "simulation"} mode.`);
    setMode("simulation");

    // Reset selected resource to first available in new mode
    const availableResources = newMode === "live" && liveResources ? liveResources : demoResources;
    setSelectedResourceId(availableResources[0]?.id ?? "");
  }

  async function runPreflightCheck(publicKey: string) {
    setBusy("preflight");
    setPreflightError(null);
    setError(null);

    try {
      const result = await checkPaymentPreflight({
        assetCode: resource.assetCode,
        assetIssuer: resource.assetIssuer,
        fetchImpl: fetch,
        network: resource.network,
        publicKey,
        requiredAmount: buildPlaygroundPaymentRequest(resource).paymentRequirements.amount
      });

      if (!result.success) {
        setPreflightError(result.error);
        setAnnouncement(`Preflight check failed: ${result.error.code}.`);
        preflightErrorRef.current?.focus();
      } else {
        setPreflightError(null);
        setAnnouncement("Preflight check passed.");
      }
    } catch (caught) {
      setError(normalizePlaygroundError(caught));
    } finally {
      setBusy(null);
    }
  }

  function runSimulatedVerify() {
    const request = paymentRequest ?? prepare(resource, authMode);

    setVerification(simulateVerification(request));
    setSettlement(null);
    setError(null);
    setAnnouncement("Simulated verification complete.");
  }

  async function runBackendVerify() {
    const request = paymentRequest ?? prepare(resource, authMode);

    setBusy("verify");
    setError(null);
    setSettlement(null);

    try {
      const verification = await apiClient.verifyPayment(request);
      setVerification(markVerificationAsLive(verification));
      setAnnouncement("Verification complete.");
    } catch (caught) {
      setVerification(null);
      setError(normalizePlaygroundError(caught));
    } finally {
      setBusy(null);
    }
  }

  function runSimulatedSettle() {
    const request = paymentRequest ?? prepare(resource, authMode);
    const currentVerification = verification ?? simulateVerification(request);

    setVerification(currentVerification);
    setSettlement(simulateSettlement(request, currentVerification));
    setError(null);
    setAnnouncement("Simulated settlement complete.");
  }

  async function runBackendSettle() {
    const request = paymentRequest ?? prepare(resource, authMode);
    const currentVerification = verification;

    if (currentVerification === null) {
      setError({
        code: "VERIFY_REQUIRED",
        message: "Verification must succeed before settlement."
      });
      setAnnouncement("Verification required before settlement.");
      errorRegionRef.current?.focus();
      return;
    }

    setBusy("settle");
    setError(null);

    try {
      const settlement = await apiClient.settlePayment(request);
      setSettlement(markSettlementAsLive(settlement));
      setAnnouncement("Settlement complete.");
    } catch (caught) {
      setSettlement(null);
      setError(normalizePlaygroundError(caught));
    } finally {
      setBusy(null);
    }
  }

  async function requestLive402Challenge() {
    setError(null);
    setChallenge(null);
    setAuthorization(null);
    setPaidFlowOutcome(null);
    setPaidFlowState(null);
    setBusy("challenge");
    
    try {
      const supported = await apiClient.getSupported();
      const expected = expectedTermsForResource(resource, supported, loadRuntimeConfig().defaultNetwork);
      
      const nextChallenge = await requestPaymentChallenge(
        {
          headers: [["Accept", "application/json"]],
          method: "GET",
          url: resource.url
        },
        expected
      );
      setChallenge(nextChallenge);
      setMode("wallet");
      setAnnouncement("Live payment challenge received.");
    } catch (caught) {
      const errorMsg = caught instanceof ChallengeError 
        ? `${caught.code}: ${caught.message}`
        : "CHALLENGE_FAILED: Could not fetch live payment challenge";
      setError({
        code: errorMsg.split(":")[0],
        message: errorMsg,
        retryable: true
      });
      errorRegionRef.current?.focus();
    } finally {
      setBusy(null);
    }
  }

  async function authorizeLivePayment() {
    if (!challenge) return;
    setError(null);
    setAuthorization(null);
    setBusy("authorize");
    
    try {
      const auth = await authorizePaymentChallenge(challenge);
      setAuthorization(auth);
      setAnnouncement("Wallet authorization complete.");
    } catch (caught) {
      const errorMsg = caught instanceof AuthorizationError
        ? `${caught.code}: ${caught.message}`
        : "AUTHORIZATION_FAILED: Could not complete wallet authorization";
      setError({
        code: errorMsg.split(":")[0],
        message: errorMsg,
        retryable: caught instanceof AuthorizationError && caught.code !== "WALLET_NETWORK_MISMATCH"
      });
      errorRegionRef.current?.focus();
    } finally {
      setBusy(null);
    }
  }

  async function submitLivePaidRequest() {
    if (!challenge || !authorization) return;
    setError(null);
    setPaidFlowOutcome(null);
    setBusy("paying");
    
    try {
      const result = await paidFlowCoordinator.execute({
        authorization,
        challenge,
        resourceId: resource.id,
        onState: setPaidFlowState
      });
      setPaidFlowOutcome(result);
      setAnnouncement(result.message);
      paidFlowOutcomeRef.current?.focus();
    } catch (caught) {
      setPaidFlowOutcome({
        message: "The paid request ended without a definitive outcome.",
        state: "indeterminate"
      });
      setError({
        code: "REQUEST_FAILED",
        message: normalizeUiError(caught, {
          code: "REQUEST_FAILED",
          description: "Payment request failed.",
          title: "Payment request failed"
        }).description,
        retryable: true
      });
      paidFlowOutcomeRef.current?.focus();
    } finally {
      setBusy(null);
    }
  }

  const verificationEvidence = verification?.extra?.lumenbazaar;
  const settlementEvidence = settlement?.extra?.lumenbazaar;
  const flowState: PaymentFlowState =
    busy === "settle"
      ? "submitted"
      : settlement?.success
        ? "confirmed"
        : verification
          ? verification.dataMode === "simulation"
            ? "simulation"
            : "wallet-draft"
          : "unknown";

  return (
    <>
      <PageHeader
        description="Select a resource, inspect exact x402 payment requirements, verify a payload, and inspect settlement evidence."
        title="Payment playground"
      />

      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        ref={statusRegionRef}
        tabIndex={-1}
      >
        {announcement}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-950">Data Mode</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Data mode">
                <Button
                  disabled={loadingLiveResources || liveResources === null}
                  onClick={() => void switchDataMode("live")}
                  type="button"
                  variant={dataMode === "live" ? "primary" : "secondary"}
                  title={liveResources === null ? "Live API currently unavailable" : ""}
                >
                  <span className="h-4 w-4" aria-hidden="true">
                    🌐
                  </span>
                  Live
                </Button>
                <Button
                  onClick={() => void switchDataMode("simulation")}
                  type="button"
                  variant={dataMode === "simulation" ? "primary" : "secondary"}
                >
                  <Play aria-hidden="true" className="h-4 w-4" />
                  Simulation
                </Button>
              </div>

              {apiLoadError ? (
                <div className="rounded-md border border-red-200 bg-red-50 p-3" role="alert">
                  <div className="flex items-start gap-2">
                    <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 text-red-700" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-900">Live resources unavailable</p>
                      <p className="mt-1 text-sm text-red-800">{apiLoadError}</p>
                      {dataMode === "live" && (
                        <Button
                          className="mt-2"
                          onClick={() => void switchDataMode("simulation")}
                          type="button"
                          variant="secondary"
                        >
                          Switch to Simulation
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              {dataMode && (
                <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <span className="text-sm text-slate-600">Mode:</span>
                  <Badge
                    tone={dataMode === "live" ? "success" : "warning"}
                    className={dataMode === "live" ? "" : ""}
                  >
                    {dataMode === "live" ? "Live API" : "Simulated (fixtures)"}
                  </Badge>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-950">Resource</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Paid resource</span>
                <select
                  className="min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus-visible:border-teal-700 focus-visible:ring-2 focus-visible:ring-teal-100"
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
                  {currentResources.map((item) => (
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
              {paidFlowOutcome && paidFlowOutcome.state !== "confirmed" ? (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3" ref={paidFlowOutcomeRef} tabIndex={-1}>
                  <p className="text-sm font-medium text-blue-900">Recovered Payment</p>
                  <p className="mt-1 text-xs text-blue-800">
                    An interrupted payment for this resource was recovered. State: {paidFlowOutcome.state}
                  </p>
                  <button
                    className="mt-2 text-xs font-medium text-blue-700 hover:text-blue-900 underline"
                    onClick={() => {
                      setPaidFlowOutcome(null);
                      setPaidFlowState(null);
                    }}
                    type="button"
                  >
                    Dismiss
                  </button>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2" role="group" aria-label="Authorization mode">
                <Button
                  onClick={() => {
                    setAuthMode("simulation");
                    prepare(resource, "simulation");
                  }}
                  type="button"
                  variant={authMode === "simulation" ? "primary" : "secondary"}
                >
                  <Play aria-hidden="true" className="h-4 w-4" />
                  Simulation
                </Button>
                <Button
                  onClick={() => {
                    setAuthMode("wallet");
                    prepare(resource, "wallet");
                  }}
                  type="button"
                  variant={authMode === "wallet" ? "primary" : "secondary"}
                >
                  <Wallet aria-hidden="true" className="h-4 w-4" />
                  Wallet draft
                </Button>
                <Button
                  disabled={busy === "challenge"}
                  onClick={() => void requestLive402Challenge()}
                  type="button"
                  variant={challenge ? "primary" : "secondary"}
                >
                  <ShieldCheck aria-hidden="true" className="h-4 w-4" />
                  {busy === "challenge" ? "Requesting..." : challenge ? "Live 402 ✓" : "Live 402"}
                </Button>
              </div>

              {mode === "wallet" && challenge === null ? (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                  <p className="font-medium">Live 402 Wallet Flow</p>
                  <p className="mt-1 text-xs">Click "Live 402" to request the actual payment challenge from the resource, then authorize with Freighter.</p>
                </div>
              ) : null}

              {mode === "wallet" && challenge ? (
                <div className="space-y-4 rounded-md border border-teal-200 bg-teal-50 p-3">
                  <div>
                    <p className="text-sm font-medium text-teal-900">Payment Challenge</p>
                    <dl className="mt-2 space-y-1 text-xs text-teal-800">
                      <div>
                        <dt className="font-medium">Amount:</dt>
                        <dd>{challenge.requirement.amount} atomic units</dd>
                      </div>
                      <div>
                        <dt className="font-medium">Network:</dt>
                        <dd>{challenge.requirement.network}</dd>
                      </div>
                      <div>
                        <dt className="font-medium">Expires:</dt>
                        <dd>{new Date(challenge.expiresAt).toLocaleString()}</dd>
                      </div>
                    </dl>
                  </div>

                  {!authorization ? (
                    <Button
                      className="w-full"
                      disabled={busy === "authorize"}
                      onClick={() => void authorizeLivePayment()}
                      type="button"
                      variant="primary"
                    >
                      <Wallet aria-hidden="true" className="h-4 w-4" />
                      {busy === "authorize" ? "Authorizing..." : "Authorize with Freighter"}
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <div className="rounded-md bg-white p-2">
                        <p className="text-xs font-medium text-slate-600">Authorized Account:</p>
                        <p className="mt-1 break-all font-mono text-xs text-slate-900">{authorization.account}</p>
                      </div>
                      <Button
                        className="w-full"
                        disabled={busy === "paying" || paidFlowOutcome !== null}
                        onClick={() => void submitLivePaidRequest()}
                        type="button"
                        variant="primary"
                      >
                        <Send aria-hidden="true" className="h-4 w-4" />
                        {busy === "paying" ? "Submitting..." : "Submit Paid Request"}
                      </Button>
                    </div>
                  )}
                </div>
              ) : null}

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

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-950">Preflight Check</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <p className="text-sm text-slate-600">
                Enter a Stellar public key to validate that the account has the required trustline and sufficient balance before payment.
              </p>
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Public Key (G...)</span>
                  <input
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                    id="payer-public-key"
                    placeholder="GBBD47UZQ...53GGVS7N"
                    type="text"
                  />
                </label>
                <Button
                  disabled={busy === "preflight"}
                  onClick={() => {
                    const input = document.getElementById("payer-public-key") as HTMLInputElement;
                    if (input.value.trim()) {
                      void runPreflightCheck(input.value.trim());
                    }
                  }}
                  type="button"
                  variant="secondary"
                >
                  <ShieldCheck aria-hidden="true" className="h-4 w-4" />
                  {busy === "preflight" ? "Checking..." : "Check Account"}
                </Button>
              </div>

              {preflightError ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3" ref={preflightErrorRef} role="alert" tabIndex={-1}>
                  <div className="flex items-start gap-2">
                    <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 text-amber-700" />
                    <div className="flex-1">
                      <Badge tone="warning">{preflightError.code}</Badge>
                      <p className="mt-2 text-sm leading-6 text-amber-800">{preflightError.message}</p>
                      {preflightError.code === "TRUSTLINE_REQUIRED" && (
                        <p className="mt-2 text-xs text-amber-700">
                          Asset: {preflightError.assetCode} ({preflightError.assetIssuer})
                        </p>
                      )}
                      {preflightError.code === "INSUFFICIENT_BALANCE" && (
                        <p className="mt-2 text-xs text-amber-700">
                          Balance: {preflightError.currentBalance} / Required: {preflightError.requiredAmount}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-950">Flow</h2>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-sm text-slate-600">Payment state</span>
                <Badge tone={flowState === "confirmed" ? "success" : paidFlowState === "confirmed" ? "success" : "neutral"}>
                  {paidFlowState ? paidFlowStateLabels[paidFlowState] : paymentFlowStateLabels[flowState]}
                </Badge>
              </div>

              {paidFlowOutcome ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{paidFlowOutcome.message}</p>
                  </div>
                  {paidFlowOutcome.receipt ? (
                    <div className="text-xs space-y-1 text-slate-700">
                      <div><dt className="font-medium">Receipt ID:</dt><dd className="break-all">{paidFlowOutcome.receipt.id}</dd></div>
                      <div><dt className="font-medium">Status:</dt><dd>{paidFlowOutcome.receipt.status}</dd></div>
                      {paidFlowOutcome.receipt.ledger ? <div><dt className="font-medium">Ledger:</dt><dd>{paidFlowOutcome.receipt.ledger}</dd></div> : null}
                    </div>
                  ) : null}
                  {paidFlowOutcome.transactionHash && paidFlowOutcome.receipt?.network ? (
                    <a
                      className="inline-flex min-h-8 items-center gap-2 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-900 shadow-sm hover:bg-slate-50"
                      href={explorerTransactionUrl(paidFlowOutcome.receipt.network, paidFlowOutcome.transactionHash)}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <ExternalLink aria-hidden="true" className="h-3 w-3" />
                      Stellar transaction
                    </a>
                  ) : null}
                </div>
              ) : null}

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
                  dataMode={verification.dataMode}
                  rows={[
                    ["Status", verification.isValid ? "verified" : "rejected"],
                    ["Attempt", verificationEvidence?.paymentAttemptId ?? "Unavailable"],
                    ["Hash", shortHash(verificationEvidence?.paymentHash)],
                    ["Adapter", verificationEvidence?.adapter ?? "Unavailable"]
                  ]}
                  tone="success"
                />
              ) : null}

              {settlement ? (
                <ResultPanel
                  label="Settlement"
                  dataMode={settlement.dataMode}
                  rows={[
                    ["Status", settlement.success ? "confirmed" : "unknown"],
                    ["Receipt", settlementEvidence?.receiptId ?? "Unavailable"],
                    ["Ledger", String(settlementEvidence?.ledger ?? "Unavailable")],
                    ["Hash", shortHash(settlement.transaction)]
                  ]}
                  tone="success"
                />
              ) : null}

              {settlement?.dataMode === "live" && settlement?.transaction ? (
                <a
                  className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50"
                  href={explorerTransactionUrl(settlement.network, settlement.transaction)}
                  rel="noreferrer"
                  target="_blank"
                >
                  <ExternalLink aria-hidden="true" className="h-4 w-4" />
                  Stellar transaction
                </a>
              ) : settlement?.dataMode === "simulation" && settlement?.transaction ? (
                <div className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  <span>Simulated result (explorer links unavailable)</span>
                </div>
              ) : null}

              {error ? (
                <div className={`rounded-md border p-3 ${error.retryable ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50"}`} ref={errorRegionRef} role="alert" tabIndex={-1}>
                  <div className="flex items-start gap-2">
                    <AlertTriangle aria-hidden="true" className={`mt-0.5 h-4 w-4 ${error.retryable ? "text-amber-700" : "text-red-700"}`} />
                    <div className="flex-1">
                      <Badge tone={error.retryable ? "warning" : "danger"}>{error.code}</Badge>
                      <p className={`mt-2 text-sm leading-6 ${error.retryable ? "text-amber-800" : "text-red-800"}`}>{error.message}</p>
                      {error.retryable ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <p className={`text-xs ${error.retryable ? "text-amber-700" : "text-red-700"}`}>This error is retryable.</p>
                          {challenge && !authorization ? (
                            <Button
                              className="h-auto py-1 px-2"
                              disabled={busy === "authorize"}
                              onClick={() => void authorizeLivePayment()}
                              size="sm"
                              type="button"
                              variant="secondary"
                            >
                              Try Again
                            </Button>
                          ) : null}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-red-700">This error requires user action before retry.</p>
                      )}
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
                    paymentRequest ??
                      buildPlaygroundPaymentRequest(resource, {
                        paymentHash: "preview-not-submitted"
                      })
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
  dataMode,
  rows,
  tone
}: {
  label: string;
  dataMode: PlaygroundDataMode;
  rows: Array<[string, string]>;
  tone: "success" | "warning" | "danger";
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3" role="status">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-950">{label}</p>
        <div className="flex items-center gap-2">
          <Badge tone={tone}>complete</Badge>
          <Badge tone={dataMode === "live" ? "success" : "warning"}>
            {dataMode === "live" ? "Live" : "Simulated"}
          </Badge>
        </div>
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

  // Determine if error is retryable based on error code
  const retryableErrors = [
    "WALLET_REJECTED",
    "WALLET_TIMEOUT",
    "WALLET_SIGNING_TIMEOUT",
    "WALLET_UNAVAILABLE",
    "SIGNATURE_INVALID",
    "WALLET_MALFORMED_SIGNATURE"
  ];
  const isRetryable = retryableErrors.includes(state.code);

  return {
    code: state.code,
    message: state.description,
    retryable: isRetryable
  };
}
