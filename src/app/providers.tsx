"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { TelemetryProvider } from "@/app/telemetry-context";
import { SellerSessionProvider } from "@/components/seller/seller-session-provider";
import { loadRuntimeConfig } from "@/config/runtime";
import { createQueryClient } from "@/services/api/query";
import {
  createTelemetryService,
  ConsoleSink,
  NoOpSink,
  type TelemetryService
} from "@/services/telemetry";

function initializeTelemetry(): TelemetryService {
  const config = loadRuntimeConfig();
  const enabled = config.features.enableTelemetry;

  // Determine consent status
  let consentStatus = "disabled_by_config";
  if (enabled) {
    // For now, we don't have explicit user consent UI, so if config enables it, we enable it
    consentStatus = "enabled";
  }

  // Use console sink in development for visibility
  const isDev = typeof process !== "undefined" && process.env.NODE_ENV === "development";
  const sink = enabled ? (isDev ? new ConsoleSink() : new NoOpSink()) : new NoOpSink();

  const telemetryService = createTelemetryService({
    enabled,
    consentStatus: consentStatus as any, // Type assertion since we control consentStatus
    networkId: config.defaultNetwork,
    sink
  });

  // Emit app_initialized event
  telemetryService.emit({
    eventType: "app_initialized",
    context: {
      sessionId: generateSessionId(),
      networkId: config.defaultNetwork
    },
    data: {
      type: "app_initialized",
      telemetryEnabled: enabled,
      consentStatus: consentStatus as any
    }
  });

  return telemetryService;
}

function generateSessionId(): string {
  // Generate a unique, opaque session ID (not wallet-specific)
  const array = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    // Fallback for environments without crypto API
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());
  const [telemetryService] = useState(() => initializeTelemetry());

  return (
    <QueryClientProvider client={queryClient}>
      <TelemetryProvider service={telemetryService}>
        <SellerSessionProvider>{children}</SellerSessionProvider>
      </TelemetryProvider>
    </QueryClientProvider>
  );
}
