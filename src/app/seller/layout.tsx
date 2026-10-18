import { SellerSessionGate } from "@/components/seller/seller-session-gate";

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return <SellerSessionGate>{children}</SellerSessionGate>;
}
