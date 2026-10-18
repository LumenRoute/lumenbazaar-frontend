"use client";

import type { FormattedAmount } from "@/lib/amount-formatter";
import { shortHash } from "@/services/payments";

export type FormattedAmountDisplayProps = {
  /** Formatted amount result from formatter, or null if metadata unknown/malformed */
  formattedAmount: FormattedAmount | null;
  /** Fallback contract ID to display when metadata is unavailable */
  fallbackContractId?: string;
  /** Optional CSS class for styling */
  className?: string;
  /** Whether to show atomic value in secondary text (default: true) */
  showAtomic?: boolean;
};

/**
 * Display a formatted amount with atomic verification view.
 *
 * When asset metadata is available:
 * - Shows formatted amount with symbol (e.g., "1.234567 USDC")
 * - Shows atomic amount and contract address in secondary text
 * - Full traceability for verification
 *
 * When metadata is unknown or malformed:
 * - Shows "Unknown asset" label
 * - Shows contract address for identification
 * - Shows atomic amount for verification
 * - Never crashes on missing or invalid metadata
 *
 * @example
 * <FormattedAmountDisplay
 *   formattedAmount={result} // FormattedAmount | null
 *   showAtomic={true}
 * />
 *
 * @example
 * // Fallback case
 * <FormattedAmountDisplay
 *   formattedAmount={null}
 *   fallbackContractId="CB256KDRXDO2FYJN3YBYZE5KCU46WIIE67DRP5T7HI45DRH2GM6YOJFS"
 *   showAtomic={true}
 * />
 */
export function FormattedAmountDisplay({
  formattedAmount,
  fallbackContractId,
  className = "",
  showAtomic = true
}: FormattedAmountDisplayProps) {
  if (formattedAmount) {
    // Metadata available: show formatted amount, symbol, atomic value, and contract
    return (
      <div className={className}>
        <div className="font-semibold text-slate-950">
          {formattedAmount.formatted} {formattedAmount.symbol}
        </div>
        {showAtomic && (
          <div className="text-xs text-slate-500">
            <div>atomic: {formattedAmount.atomic}</div>
            <div>contract: {shortHash(formattedAmount.contractId)}</div>
          </div>
        )}
      </div>
    );
  }

  // Fallback: metadata unknown or malformed
  return (
    <div className={className}>
      <div className="font-semibold text-slate-950">Unknown asset</div>
      {showAtomic && (
        <div className="text-xs text-slate-500">
          <div>contract: {shortHash(fallbackContractId || "unknown")}</div>
        </div>
      )}
    </div>
  );
}
