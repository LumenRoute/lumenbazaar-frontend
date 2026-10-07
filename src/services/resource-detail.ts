import { apiClient, type LumenBazaarApiClient } from "@/services/api/client";
import type { Receipt, Resource, ResourcePaymentSummary, Seller } from "@/services/api/schemas";
import { isDemoMode, type RuntimeEnvironment } from "@/config/runtime";

import { demoReceipts, findDemoResource, findDemoSeller } from "@/fixtures/lumenbazaar";
import { currentRuntimeMode } from "@/services/runtime-mode";

export type ResourceDetailSnapshot = {
  receipts: Receipt[];
  requirement: ResourcePaymentSummary;
  resource: Resource;
  seller?: Seller;
  source: "api" | "demo";
};

type ResourceDetailClient = Pick<LumenBazaarApiClient, "getResource">;

export async function loadResourceDetail(
  resourceId: string,
  client: ResourceDetailClient = apiClient,
  mode: RuntimeEnvironment = currentRuntimeMode()
): Promise<ResourceDetailSnapshot> {
  if (isDemoMode(mode)) {
    const resource = findDemoResource(resourceId);

    if (resource === undefined) throw new Error("RESOURCE_NOT_FOUND");

    return {
      receipts: demoReceipts.filter((receipt) => receipt.resourceId === resourceId),
      requirement: buildPaymentRequirement(resource),
      resource,
      seller: findDemoSeller(resource.sellerId),
      source: "demo"
    };
  }

  const resource = await client.getResource(resourceId);

  return {
    receipts: [],
    requirement: buildPaymentRequirement(resource),
    resource,
    source: "api"
  };
}

export function buildPaymentRequirement(resource: Resource): ResourcePaymentSummary {
  return {
    amount: resource.amount,
    assetCode: resource.assetCode,
    assetIssuer: resource.assetIssuer,
    extensions: resource.extensions,
    network: resource.network,
    payTo: resource.payTo,
    resourceId: resource.id
  };
}
