import {
  demoPaymentAttempts,
  demoSettlements,
  findDemoReceiptByAttempt,
  findDemoResource,
  findDemoSeller,
  type DemoPaymentAttempt,
  type DemoSettlement
} from "@/fixtures/lumenbazaar";
import { getNetworkConfig, type NetworkId } from "@/config/networks";
import { apiClient, type LumenBazaarApiClient } from "@/services/api/client";
import type {
  Receipt,
  Resource,
  ResourceStatus,
  ResourceType,
  Seller
} from "@/services/api/schemas";
import type { RuntimeEnvironment } from "@/config/runtime";
import { currentRuntimeMode, requireDemoMode } from "@/services/runtime-mode";

export type PaymentActivityStatus = DemoPaymentAttempt["status"] | DemoSettlement["status"];

export type PaymentActivity = {
  attempt: DemoPaymentAttempt;
  receipt?: Receipt;
  resource?: Resource;
  seller?: Seller;
  settlement?: DemoSettlement;
};

export type PaymentActivityFilters = {
  asset?: string;
  date?: string;
  network?: NetworkId;
  resourceType?: ResourceType;
  sellerId?: string;
  status?: PaymentActivityStatus;
};

export type SellerResourceFilters = {
  asset?: string;
  network?: NetworkId;
  sellerId?: string;
  status?: ResourceStatus;
  type?: ResourceType;
};

export type SellerResourceSnapshot = {
  fetchedAt: string;
  resources: Resource[];
  source: "api" | "demo";
};

type SellerResourceClient = Pick<LumenBazaarApiClient, "listSellerResources">;

export async function loadSellerResourceSnapshot(
  filters: SellerResourceFilters = {},
  client: SellerResourceClient = apiClient,
  mode: RuntimeEnvironment = currentRuntimeMode()
): Promise<SellerResourceSnapshot> {
  if (mode === "demo") {
    return {
      fetchedAt: new Date().toISOString(),
      resources: loadSellerResources(filters, mode),
      source: "demo"
    };
  }

  const sellerId = filters.sellerId ?? "seller_atlas_weather";
  const page = await client.listSellerResources(sellerId, {
    asset: filters.asset,
    network: filters.network,
    status: filters.status,
    type: filters.type
  });
  return {
    fetchedAt: new Date().toISOString(),
    resources: page.resources,
    source: "api"
  };
}

export function loadSellerResources(
  filters: SellerResourceFilters = {},
  mode: RuntimeEnvironment = currentRuntimeMode()
) {
  requireDemoMode(mode);
  const sellerId = filters.sellerId ?? "seller_atlas_weather";

  return demoPaymentResources().filter(
    (resource) =>
      resource.sellerId === sellerId &&
      (filters.status === undefined || resource.status === filters.status) &&
      (filters.network === undefined || resource.network === filters.network) &&
      (filters.asset === undefined ||
        resource.assetCode.toLowerCase() === filters.asset.toLowerCase()) &&
      (filters.type === undefined || resource.type === filters.type)
  );
}

export function loadPaymentActivity(
  filters: PaymentActivityFilters = {},
  mode: RuntimeEnvironment = currentRuntimeMode()
): PaymentActivity[] {
  requireDemoMode(mode);
  return demoPaymentAttempts
    .map((attempt) => ({
      attempt,
      receipt: findDemoReceiptByAttempt(attempt.id),
      resource: findDemoResource(attempt.resourceId),
      seller: findDemoSeller(attempt.sellerId),
      settlement: demoSettlements.find((settlement) => settlement.paymentAttemptId === attempt.id)
    }))
    .filter((activity) => {
      const status = activity.settlement?.status ?? activity.attempt.status;

      return (
        (filters.sellerId === undefined || activity.attempt.sellerId === filters.sellerId) &&
        (filters.status === undefined ||
          status === filters.status ||
          activity.attempt.status === filters.status) &&
        (filters.network === undefined || activity.attempt.network === filters.network) &&
        (filters.date === undefined || sameUtcDate(activity.attempt.createdAt, filters.date)) &&
        (filters.asset === undefined ||
          activity.attempt.assetCode.toLowerCase() === filters.asset.toLowerCase()) &&
        (filters.resourceType === undefined || activity.resource?.type === filters.resourceType)
      );
    })
    .sort((left, right) => right.attempt.createdAt.localeCompare(left.attempt.createdAt));
}

export function loadSellerPaymentActivity(
  sellerId = "seller_atlas_weather",
  mode: RuntimeEnvironment = currentRuntimeMode()
) {
  return loadPaymentActivity({ sellerId }, mode);
}

export function paymentActivityStatus(activity: PaymentActivity) {
  return activity.settlement?.status ?? activity.attempt.status;
}

export function explorerTransactionUrl(network: NetworkId, transactionHash: string) {
  return `${getNetworkConfig(network).explorerUrl}/tx/${transactionHash}`;
}

export function formatPaymentAmount(amount: string, assetCode: string) {
  const value = Number(amount);

  if (Number.isFinite(value)) {
    return `${value.toFixed(4)} ${assetCode}`;
  }

  return `${amount} ${assetCode}`;
}

export function shortHash(value: string | null | undefined) {
  if (value === undefined || value === null || value.length <= 16) {
    return value ?? "Unavailable";
  }

  return `${value.slice(0, 8)}...${value.slice(-8)}`;
}

function demoPaymentResources() {
  return [
    ...new Map(
      demoPaymentAttempts.map((attempt) => [
        attempt.resourceId,
        findDemoResource(attempt.resourceId)
      ])
    ).values()
  ].filter((resource): resource is Resource => resource !== undefined);
}

function sameUtcDate(value: string, date: string) {
  return value.slice(0, 10) === date;
}
