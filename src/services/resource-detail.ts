import { apiClient, type LumenBazaarApiClient } from "@/services/api/client";
import type { Receipt, Resource, Seller } from "@/services/api/schemas";

import { demoReceipts, findDemoResource, findDemoSeller } from "@/fixtures/lumenbazaar";

export type ResourceDetailSnapshot = {
  receipts: Receipt[];
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
      resource,
      seller: findDemoSeller(resource.sellerId),
      source: "demo"
    };
  }
}
