"use client";

import { Copy, AlertCircle, Check } from "lucide-react";
import { useState } from "react";
import type { AssetMetadata } from "@/config/networks";

export type ContractAddressComparisonProps = {
  /** Full Soroban contract ID from the payment requirement (C* format, 56 chars) */
  contractId: string;
  /** Optional registry entry to compare against */
  registryEntry?: AssetMetadata;
  /** Optional CSS class for styling */
  className?: string;
};

/**
 * Displays a payment requirement's contract address with optional comparison
 * to a registry entry. Allows copying the contract ID to clipboard.
 *
 * When a registry entry is provided, displays both addresses side-by-side
 * with a match/mismatch indicator to help users detect lookalike attacks.
 *
 * Features:
 * - Full 56-character contract ID display (monospace, break-all)
 * - Copy-to-clipboard button with feedback
 * - Optional registry entry comparison
 * - Match/mismatch indicator for lookalike detection
 * - Responsive design (no horizontal overflow on mobile)
 * - Accessible: copy button has aria-label, match indicator uses icon + text
 *
 * @example
 * // Display requirement-only (unknown asset)
 * <ContractAddressComparison
 *   contractId="CBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE"
 * />
 *
 * @example
 * // Display comparison (trusted asset)
 * <ContractAddressComparison
 *   contractId="CBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE"
 *   registryEntry={{
 *     contractId: "CBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE",
 *     symbol: "USDC",
 *     decimals: 6
 *   }}
 * />
 */
export function ContractAddressComparison({
  contractId,
  registryEntry,
  className
}: ContractAddressComparisonProps) {
  const [copied, setCopied] = useState(false);

  const copyContract = async () => {
    try {
      await navigator.clipboard.writeText(contractId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silently fail if clipboard access is denied
      console.warn("Failed to copy contract address to clipboard");
    }
  };

  const addressesMatch = registryEntry && registryEntry.contractId === contractId;

  return (
    <div
      className={
        className ||
        "rounded-md border border-slate-200 bg-slate-50 p-4 space-y-3"
      }
    >
      {/* Requirement Contract Address */}
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Payment Requirement
        </dt>
        <dd className="mt-2 flex items-start justify-between gap-3">
          <code className="break-all font-mono text-xs leading-relaxed text-slate-700">
            {contractId}
          </code>
          <button
            type="button"
            onClick={copyContract}
            className="mt-1 flex-shrink-0 rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-0"
            aria-label="Copy contract address"
            title={copied ? "Copied!" : "Copy to clipboard"}
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            ) : (
              <Copy className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </dd>
      </div>

      {/* Registry Entry (if provided) */}
      {registryEntry && (
        <>
          <div className="border-t border-slate-200" />
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Trusted Registry Entry
            </dt>
            <dd className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">
                  {registryEntry.symbol}
                </span>
                <span className="text-xs text-slate-500">
                  decimals: {registryEntry.decimals}
                </span>
                {registryEntry.issuer && (
                  <span className="text-xs text-slate-500">
                    issuer: {registryEntry.issuer.slice(0, 8)}...
                  </span>
                )}
              </div>
              <code className="block break-all font-mono text-xs leading-relaxed text-slate-600">
                {registryEntry.contractId}
              </code>
            </dd>
          </div>

          {/* Match/Mismatch Indicator */}
          <div className="border-t border-slate-200 pt-2">
            {addressesMatch ? (
              <div className="flex items-center gap-2 text-sm text-emerald-700">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100">
                  <span className="text-xs font-bold">✓</span>
                </span>
                <span className="font-medium">Contract addresses match</span>
              </div>
            ) : (
              <div className="flex items-start gap-2 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-medium">Contract addresses do not match</p>
                  <p className="mt-1 text-xs text-red-600">
                    Potential lookalike: same symbol, different contract
                  </p>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* No Registry Entry Message */}
      {!registryEntry && (
        <>
          <div className="border-t border-slate-200" />
          <p className="text-xs text-slate-500">
            This contract address is not in the trusted registry for this network.
            Verify the address before proceeding.
          </p>
        </>
      )}
    </div>
  );
}
