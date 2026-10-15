"use client";

import { createContext, useMemo, type ReactNode } from "react";

import type { TelemetryService } from "@/services/telemetry";

/**
 * React Context for injecting telemetry service into components.
 * Initialized in Providers with the configured service.
 */
export const TelemetryContext = createContext<TelemetryService | null>(null);

export type TelemetryProviderProps = {
  children: ReactNode;
  service: TelemetryService;
};

/**
 * Provider component to inject telemetry service into the React tree.
 */
export function TelemetryProvider({ children, service }: TelemetryProviderProps) {
  // Wrap service in useMemo to prevent unnecessary re-renders
  const value = useMemo(() => service, [service]);

  return <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>;
}
