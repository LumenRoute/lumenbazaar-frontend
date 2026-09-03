import { demoReceipts, demoResources, demoSellers, findDemoSeller } from "@/fixtures/lumenbazaar";
import type { Receipt, Resource, Seller } from "@/services/api/schemas";

export type SellerDashboardSnapshot = {
  identityStatus: "connected" | "missing";
  recentPayments: Receipt[];
  resourceCount: number;
  resources: Resource[];
  seller: Seller;
  verificationStatus: "verified" | "unverified";
};

export function loadSellerDashboard(
  sellerId: string = demoSellers[0]?.id ?? "seller_atlas_weather"
): SellerDashboardSnapshot {
  const seller = findDemoSeller(sellerId) ?? demoSellers[0];

  if (seller === undefined) {
    throw new Error("SELLER_NOT_FOUND");
  }

  const resources = demoResources.filter((resource) => resource.sellerId === seller.id);
  const recentPayments = demoReceipts.filter((receipt) => receipt.sellerId === seller.id);

  return {
    identityStatus: seller.walletAddress.length > 0 ? "connected" : "missing",
    recentPayments,
    resourceCount: resources.length,
    resources,
    seller,
    verificationStatus: seller.domainVerifiedAt === null ? "unverified" : "verified"
  };
}
