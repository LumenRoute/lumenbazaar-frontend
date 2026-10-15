"use client";

import { useContext } from "react";

import { TelemetryContext } from "@/app/telemetry-context";
import type { TelemetryService } from "@/services/telemetry";

/**
 * Hook to access the telemetry service from components.
 * Must be used within a TelemetryProvider.
 */
export function useTelemetry(): TelemetryService {
  const service = useContext(TelemetryContext);

  if (!service) {
    throw new Error("useTelemetry must be used within TelemetryProvider");
  }

  return service;
}
