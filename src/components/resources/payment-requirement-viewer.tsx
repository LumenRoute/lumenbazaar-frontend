"use client";

import { Clipboard, ReceiptText, TriangleAlert, AlertTriangle } from "lucide-react";
import { useMemo, useState, useRef, useEffect } from "react";

import { tryFormatAmount } from "@/lib/amount-formatter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormattedAmountDisplay } from "@/components/ui/formatted-amount";
import { getNetworkConfig } from "@/config/networks";
import { classifyAssetTrust, assetTrustLabel } from "@/services/api/asset-trust";
import { ContractAddressComparison } from "./contract-address-comparison";
import type { ErrorCode, ResourcePaymentSummary } from "@/services/api/schemas";
import type { AssetTrustStatus } from "@/services/api/asset-trust";

import { prettyJson } from "./schema-utils";

type PaymentRequirementViewerProps = {
  failureReasons?: Array<{
    code: ErrorCode | string;
    message: string;
  }>;
  requirement: ResourcePaymentSummary;
  /** Optional callback when user confirms proceeding with an unknown asset */
  onConfirmUnknownAsset?: () => void;
};

export function PaymentRequirementViewer({
  failureReasons = [],
  requirement,
  onConfirmUnknownAsset
}: PaymentRequirementViewerProps) {
  const [copied, setCopied] = useState(false);
  const [confirmUnknownAsset, setConfirmUnknownAsset] = useState(false);
  const warningHeadingRef = useRef<HTMLHeadingElement>(null);

  // Classify the asset trust status
  const assetContractId = requirement.extensions?.assetContractId as string | undefined;
  const assetTrust: AssetTrustStatus | undefined = assetContractId
    ? classifyAssetTrust(assetContractId, requirement.network)
    : undefined;

  const isUnknownAsset = assetTrust?.type === "unknown";
  const isMalformedAsset = assetTrust?.type === "malformed";

  // Focus warning heading when unknown asset warning appears
  useEffect(() => {
    if (isUnknownAsset && warningHeadingRef.current) {
      warningHeadingRef.current.focus({ preventScroll: true });
    }
  }, [isUnknownAsset]);

  // Format the amount using network-specific asset metadata
  const networkConfig = getNetworkConfig(requirement.network);
  const formattedAmount = useMemo(
    () =>
      tryFormatAmount(requirement.amount, requirement.assetCode, requirement.network),
    [requirement.amount, requirement.assetCode, requirement.network]
  );

  async function copyPayload() {
    await navigator.clipboard.writeText(prettyJson(requirement));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const handleProceedWithUnknownAsset = () => {
    if (confirmUnknownAsset) {
      onConfirmUnknownAsset?.();
    }
  };

  // If asset is unknown or malformed, show blocking warning
  if ((isUnknownAsset || isMalformedAsset) && assetTrust) {
    return (
      <div className="space-y-4">
        {/* Unknown Asset Warning Card */}
        <Card>
          <CardBody className="flex gap-3">
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700"
            />
            <div className="flex-1">
              <h3
                ref={warningHeadingRef}
                className="font-semibold text-amber-900"
                tabIndex={-1}
              >
                {isMalformedAsset ? "Invalid Asset Contract" : "Unknown Asset"}
              </h3>
              <p className="mt-2 text-sm text-amber-800">
                {isMalformedAsset
                  ? "This payment asset has an invalid contract ID and cannot be processed."
                  : "This payment asset is not in the trusted registry for " +
                    requirement.network +
                    ". Verify the contract address carefully before proceeding."}
              </p>
            </div>
          </CardBody>
        </Card>

        {/* Contract Address Comparison */}
        {assetContractId && (
          <ContractAddressComparison
            contractId={assetContractId}
            registryEntry={
              assetTrust.type === "trusted" ? assetTrust.registryEntry : undefined
            }
          />
        )}

        {/* Confirmation Checkbox (only for unknown, not malformed) */}
        {isUnknownAsset && (
          <>
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
              <label className="flex items-start gap-3">
                <input
                  id="confirm-unknown-asset"
                  type="checkbox"
                  checked={confirmUnknownAsset}
                  onChange={(e) => setConfirmUnknownAsset(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  aria-describedby="confirm-unknown-asset-description"
                />
                <span className="flex-1 text-sm text-amber-900">
                  <span className="font-medium">
                    I understand this asset is not in the trusted registry
                  </span>
                  <span id="confirm-unknown-asset-description" className="block text-xs text-amber-700 mt-1">
                    I have verified the contract address and proceed at my own risk.
                  </span>
                </span>
              </label>
            </div>

            {/* Proceed Button */}
            <Button
              type="button"
              disabled={!confirmUnknownAsset}
              onClick={handleProceedWithUnknownAsset}
              className="w-full sm:w-auto"
            >
              Proceed with Unknown Asset
            </Button>
          </>
        )}

        {/* Malformed Asset Message */}
        {isMalformedAsset && (
          <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            Please correct the contract ID and try again.
          </p>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Catalog payment summary</h2>
          <p className="mt-1 text-sm text-slate-600">
            Discovery metadata only. The paid endpoint challenge is authoritative.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={copyPayload}>
          <Clipboard aria-hidden="true" className="h-4 w-4" />
          {copied ? "Copied" : "Copy JSON"}
        </Button>
      </CardHeader>
      <CardBody className="space-y-5">
        {/* Trust Status Badge (if trusted) */}
        {assetTrust?.type === "trusted" && (
          <div className="flex items-center gap-2">
            <Badge tone="success">Trusted Asset</Badge>
            <span className="text-xs text-slate-500">{assetTrustLabel(assetTrust)}</span>
          </div>
        )}
        <dl className="grid gap-4 text-sm md:grid-cols-2 xl:grid-cols-4">
          <Field label="Network" value={requirement.network} />
          <div className="min-w-0">
            <dt className="text-slate-500">Amount</dt>
            <dd className="mt-1">
              <FormattedAmountDisplay
                fallbackContractId={requirement.assetCode}
                formattedAmount={formattedAmount}
                showAtomic={true}
              />
            </dd>
          </div>
          <Field label="Asset issuer" value={requirement.assetIssuer} wrap />
          <Field label="Recipient" value={requirement.payTo} wrap />
          <Field label="Resource" value={requirement.resourceId} wrap />
        </dl>

        {/* Contract Address Comparison Section */}
        {assetContractId && assetTrust?.type === "trusted" && (
          <ContractAddressComparison
            contractId={assetContractId}
            registryEntry={assetTrust.registryEntry}
            className="rounded-md border border-emerald-200 bg-emerald-50 p-4 space-y-3"
          />
        )}

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

