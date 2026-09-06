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
import type {
  Receipt,
  Resource,
  ResourceStatus,
  ResourceType,
  Seller
} from "@/services/api/schemas";

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

export function loadSellerResources(filters: SellerResourceFilters = {}) {
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

export function loadPaymentActivity(filters: PaymentActivityFilters = {}): PaymentActivity[] {
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
        (filters.asset === undefined ||
          activity.attempt.assetCode.toLowerCase() === filters.asset.toLowerCase()) &&
        (filters.resourceType === undefined || activity.resource?.type === filters.resourceType)
      );
    })
    .sort((left, right) => right.attempt.createdAt.localeCompare(left.attempt.createdAt));
}

export function loadSellerPaymentActivity(sellerId = "seller_atlas_weather") {
  return loadPaymentActivity({ sellerId });
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
