import { apiClient, type LumenBazaarApiClient } from "@/services/api/client";
import type { PaymentRequirement, Receipt, Resource, Seller } from "@/services/api/schemas";

import { demoReceipts, findDemoResource, findDemoSeller } from "@/fixtures/lumenbazaar";

export type ResourceDetailSnapshot = {
  receipts: Receipt[];
  requirement: PaymentRequirement;
  resource: Resource;
  seller?: Seller;
  source: "api" | "demo";
};

type ResourceDetailClient = Pick<LumenBazaarApiClient, "getResource">;

export async function loadResourceDetail(
  resourceId: string,
  client: ResourceDetailClient = apiClient
): Promise<ResourceDetailSnapshot> {
  try {
    const resource = await client.getResource(resourceId);

    return {
      receipts: [],
      requirement: buildPaymentRequirement(resource),
      resource,
      source: "api"
    };
  } catch {
    const resource = findDemoResource(resourceId);

    if (resource === undefined) {
      throw new Error("RESOURCE_NOT_FOUND");
    }

    return {
      receipts: demoReceipts.filter((receipt) => receipt.resourceId === resourceId),
      requirement: buildPaymentRequirement(resource),
      resource,
      seller: findDemoSeller(resource.sellerId),
      source: "demo"
    };
  }
}

export function buildPaymentRequirement(resource: Resource): PaymentRequirement {
  return {
    amount: resource.amount,
    assetCode: resource.assetCode,
    assetIssuer: resource.assetIssuer,
    expiresAtLedger: null,
    extensions: resource.extensions,
    network: resource.network,
    payTo: resource.payTo,
    resourceId: resource.id,
    scheme: "exact",
    x402Version: "1"
  };
}
