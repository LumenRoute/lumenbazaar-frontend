import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "LumenBazaar",
  description: "Inspect Stellar x402 resources, payments, and operator status."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
