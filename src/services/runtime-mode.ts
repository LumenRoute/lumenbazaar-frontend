import { isDemoMode, loadRuntimeConfig, type RuntimeEnvironment } from "@/config/runtime";
import { ApiClientError } from "@/services/api/client";

export function currentRuntimeMode() {
  return loadRuntimeConfig().environment;
}

export function requireDemoMode(mode: RuntimeEnvironment = currentRuntimeMode()) {
  if (!isDemoMode(mode)) {
    throw new ApiClientError({
      code: "DEMO_MODE",
      message: "Bundled fixtures are available only when NEXT_PUBLIC_LUMENBAZAAR_ENV=demo.",
      status: 0
    });
  }
}
