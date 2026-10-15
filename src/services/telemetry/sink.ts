/**
 * Telemetry sink implementations.
 * A sink is where validated events are sent (no-op, console, remote endpoint, etc.).
 */

import type { TelemetryEvent, TelemetrySink } from "./types";

/**
 * No-operation sink. Silently discards all events.
 * Used when telemetry is disabled.
 */
export class NoOpSink implements TelemetrySink {
  send(_event: TelemetryEvent): void {
    // intentionally empty
  }
}

/**
 * Console sink. Logs events to console (development/debugging only).
 */
export class ConsoleSink implements TelemetrySink {
  private static readonly PREFIX = "[Telemetry]";

  send(event: TelemetryEvent): void {
    const message = `event: ${event.eventType}`;
    const meta = {
      timestamp: new Date(event.timestamp).toISOString(),
      ...event.context,
      ...event.data
    };

    // eslint-disable-next-line no-console
    console.log(`${ConsoleSink.PREFIX} ${message}`, meta);
  }
}

/**
 * Remote sink. Sends events to a remote HTTP endpoint (future implementation).
 * Currently a placeholder; actual implementation deferred for future vendor integration.
 */
export class RemoteSink implements TelemetrySink {
  private endpoint: string;
  private queue: TelemetryEvent[] = [];
  private flushInterval: number;
  private timer: NodeJS.Timeout | null = null;

  constructor(endpoint: string, flushInterval = 5000) {
    this.endpoint = endpoint;
    this.flushInterval = flushInterval;
    this.startFlushTimer();
  }

  send(event: TelemetryEvent): void {
    this.queue.push(event);
    
    // Flush immediately if queue grows large
    if (this.queue.length >= 10) {
      this.flush();
    }
  }

  private startFlushTimer(): void {
    this.timer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  private async flush(): Promise<void> {
    if (this.queue.length === 0) {
      return;
    }

    const events = this.queue.splice(0);
    
    try {
      // Placeholder: actual implementation would POST events to endpoint
      // eslint-disable-next-line no-console
      console.debug(`[RemoteSink] would send ${events.length} events to ${this.endpoint}`);
      
      // In a real implementation:
      // const response = await fetch(this.endpoint, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ events }),
      //   timeout: 5000
      // });
      // if (!response.ok) {
      //   this.queue.push(...events); // re-queue on failure
      // }
    } catch (error) {
      // Re-queue events if send fails
      this.queue.unshift(...events);
    }
  }

  destroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.flush();
  }
}
