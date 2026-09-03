"use client";

import { AlertCircle, DollarSign, Wallet } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/api/client";
import { type NetworkId, stellarNetworks } from "@/config/networks";
import { type ResourceDraft } from "@/services/resource-creation";

type ResourceWizardPricingProps = {
  draft: ResourceDraft;
  onUpdate: (updates: Partial<ResourceDraft>) => void;
  onNext: () => void;
  onPrev: () => void;
  isLoading?: boolean;
};

const STELLAR_ADDRESS_REGEX = /^G[A-Z2-7]{56}$/;

export function validateStellarAddress(address: string): boolean {
  return STELLAR_ADDRESS_REGEX.test(address);
}

export function ResourceWizardPricing({
  draft,
  onUpdate,
  onNext,
  onPrev,
  isLoading = false
}: ResourceWizardPricingProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch available networks and assets
  const { data: networksData, isLoading: isLoadingNetworks } = useQuery({
    queryKey: ["networks"],
    queryFn: () => apiClient.getNetworks(),
    staleTime: 1000 * 60 * 5 // 5 minutes
  });

  // Get current network config to show assets
  const currentNetwork = draft.network ? stellarNetworks[draft.network] : null;
  const availableAssets = networksData?.networks
    .find((n) => n.id === draft.network)
    ?.assets || [{ code: currentNetwork?.defaultAssetCode || "USDC", issuer: currentNetwork?.defaultAssetIssuer || "", decimals: 7 }];

  // Initialize with default values if not set
  useEffect(() => {
    if (!draft.network && networksData?.networks.length) {
      onUpdate({ network: networksData.networks[0]!.id as NetworkId });
    }
  }, [networksData, draft.network, onUpdate]);

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};

    if (!draft.network) {
      newErrors.network = "Network is required";
    }

    if (!draft.assetCode?.trim()) {
      newErrors.assetCode = "Asset is required";
    }

    if (!draft.amount?.trim()) {
      newErrors.amount = "Amount is required";
    } else {
      const amount = parseFloat(draft.amount);
      if (isNaN(amount) || amount <= 0) {
        newErrors.amount = "Amount must be a positive number";
      }
    }

    if (!draft.payTo?.trim()) {
      newErrors.payTo = "Payment recipient is required";
    } else if (!validateStellarAddress(draft.payTo)) {
      newErrors.payTo = "Must be a valid Stellar address (starts with G and 56 characters)";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleNext() {
    if (validateForm()) {
      onNext();
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <div className="flex items-center gap-2">
            <DollarSign aria-hidden="true" className="h-5 w-5 text-teal-700" />
            <h2 className="text-lg font-semibold text-slate-950">Pricing and payment</h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Set the network, asset, amount, and recipient address for this resource.
          </p>
        </div>
      </CardHeader>
      <CardBody className="space-y-6">
        <div className="space-y-4">
          <label className="space-y-1">
            <span className="block text-sm font-medium text-slate-700">
              Network <span className="text-red-600">*</span>
            </span>
            <select
              className="min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
              value={draft.network || ""}
              onChange={(e) => {
                const network = e.target.value as NetworkId;
                onUpdate({ network });
              }}
              disabled={isLoadingNetworks || isLoading}
            >
              <option value="">Select a network...</option>
              {networksData?.networks.map((network) => (
                <option key={network.id} value={network.id}>
                  {network.displayName}
                </option>
              ))}
            </select>
            {errors.network ? <p className="text-xs text-red-600">{errors.network}</p> : null}
          </label>

          <label className="space-y-1">
            <span className="block text-sm font-medium text-slate-700">
              Asset <span className="text-red-600">*</span>
            </span>
            <select
              className="min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
              value={draft.assetCode || ""}
              onChange={(e) => {
                const selectedAsset = availableAssets.find((a) => a.code === e.target.value);
                if (selectedAsset) {
                  onUpdate({
                    assetCode: selectedAsset.code,
                    assetIssuer: selectedAsset.issuer
                  });
                }
              }}
              disabled={isLoading || !draft.network}
            >
              <option value="">Select an asset...</option>
              {availableAssets.map((asset) => (
                <option key={asset.code} value={asset.code}>
                  {asset.code} (decimals: {asset.decimals})
                </option>
              ))}
            </select>
            {errors.assetCode ? <p className="text-xs text-red-600">{errors.assetCode}</p> : null}
          </label>

          <label className="space-y-1">
            <span className="block text-sm font-medium text-slate-700">
              Amount <span className="text-red-600">*</span>
            </span>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="0.00"
                step="0.0001"
                min="0"
                value={draft.amount || ""}
                onChange={(e) => onUpdate({ amount: e.target.value })}
                className={`flex-1 rounded-md border px-3 py-2 text-sm outline-none transition-colors ${
                  errors.amount
                    ? "border-red-600 focus:ring-red-100"
                    : "border-slate-300 focus:ring-teal-100"
                } focus:border-teal-700 focus:ring-2`}
              />
              {draft.assetCode && <Badge>{draft.assetCode}</Badge>}
            </div>
            {errors.amount ? <p className="text-xs text-red-600">{errors.amount}</p> : null}
            <p className="text-xs text-slate-500">
              Amount charged per request in {draft.assetCode || "selected asset"}
            </p>
          </label>

          <label className="space-y-1">
            <span className="block text-sm font-medium text-slate-700">
              Payment recipient <span className="text-red-600">*</span>
            </span>
            <div className="flex items-center gap-2">
              <Wallet aria-hidden="true" className="h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                value={draft.payTo || ""}
                onChange={(e) => onUpdate({ payTo: e.target.value })}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-mono outline-none transition-colors ${
                  errors.payTo
                    ? "border-red-600 focus:ring-red-100"
                    : "border-slate-300 focus:ring-teal-100"
                } focus:border-teal-700 focus:ring-2`}
              />
            </div>
            {errors.payTo ? (
              <div className="mt-2 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-600" aria-hidden="true" />
                <p className="text-xs text-red-600">{errors.payTo}</p>
              </div>
            ) : null}
            {draft.payTo && validateStellarAddress(draft.payTo) ? (
              <div className="mt-2 flex items-start gap-2 rounded-md border border-green-200 bg-green-50 p-2">
                <p className="text-xs text-green-700">✓ Valid Stellar address</p>
              </div>
            ) : null}
            <p className="text-xs text-slate-500">
              Payments will be sent to this Stellar address
            </p>
          </label>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 pt-6">
          <div className="text-xs text-slate-500">
            {draft.amount && draft.assetCode ? (
              <span>
                Price: <span className="font-semibold">{draft.amount} {draft.assetCode}</span>
              </span>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button onClick={onPrev} variant="secondary" disabled={isLoading} type="button">
              ← Back
            </Button>
            <Button onClick={handleNext} disabled={isLoading} type="button">
              Continue to metadata →
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
