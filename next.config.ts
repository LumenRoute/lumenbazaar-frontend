import type { NextConfig } from "next";

import { loadRuntimeConfig } from "./src/config/runtime";
import { buildSecurityHeaders } from "./src/config/security";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        headers: buildSecurityHeaders(loadRuntimeConfig()),
        source: "/:path*"
      }
    ];
  }
};

export default nextConfig;
