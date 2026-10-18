/**
 * Shared bounded polling with exponential backoff.
 *
 * Used by receipt finality polling (issue 44) and domain verification polling
 * (issue 43). The helper is deliberately transport-free: callers supply a
 * single `check` function that performs exactly one read, which keeps polling
 * side-effect free and prevents accidental repeats of mutating requests.
 */

export type PollVisibility = {
  isHidden: () => boolean;
  subscribe: (listener: () => void) => () => void;
};

export type BoundedPollOptions<T> = {
  check: (attempt: number) => Promise<T>;
  isTerminal: (value: T) => boolean;
  signal?: AbortSignal;
  visibility?: PollVisibility;
  initialDelayMs?: number;
  maxDelayMs?: number;
  multiplier?: number;
  maxAttempts?: number;
  maxElapsedMs?: number;
  /** Injectable clock so tests can use a deterministic schedule. */
  now?: () => number;
  /** Resolves true when the delay completed, false when it was aborted. */
  sleep?: (delayMs: number, signal: AbortSignal) => Promise<boolean>;
  onPoll?: (attempt: number, value: T) => void;
};

export type BoundedPollResult<T> =
  | { attempts: number; elapsedMs: number; status: "terminal"; value: T }
  | {
      attempts: number;
      elapsedMs: number;
      reason: "attempts" | "timeout";
      status: "exhausted";
      value: T | undefined;
    }
  | { attempts: number; elapsedMs: number; status: "cancelled"; value: T | undefined };

export const DEFAULT_POLL_SCHEDULE = {
  initialDelayMs: 500,
  maxDelayMs: 8_000,
  maxAttempts: 8,
  maxElapsedMs: 45_000,
  multiplier: 2
} as const;

export function nextBackoffDelay(
  delayMs: number,
  {
    maxDelayMs = DEFAULT_POLL_SCHEDULE.maxDelayMs,
    multiplier = DEFAULT_POLL_SCHEDULE.multiplier
  }: { maxDelayMs?: number; multiplier?: number } = {}
) {
  return Math.min(Math.round(delayMs * multiplier), maxDelayMs);
}

export async function pollWithBackoff<T>({
  check,
  isTerminal,
  initialDelayMs = DEFAULT_POLL_SCHEDULE.initialDelayMs,
  maxDelayMs = DEFAULT_POLL_SCHEDULE.maxDelayMs,
  maxAttempts = DEFAULT_POLL_SCHEDULE.maxAttempts,
  maxElapsedMs = DEFAULT_POLL_SCHEDULE.maxElapsedMs,
  multiplier = DEFAULT_POLL_SCHEDULE.multiplier,
  now = Date.now,
  onPoll,
  signal,
  sleep = abortableSleep,
  visibility
}: BoundedPollOptions<T>): Promise<BoundedPollResult<T>> {
  const startedAt = now();
  const elapsed = () => now() - startedAt;
  let attempts = 0;
  let delay = initialDelayMs;
  let value: T | undefined;

  if (isAborted(signal)) {
    return { attempts: 0, elapsedMs: 0, status: "cancelled", value: undefined };
  }

  while (true) {
    if (elapsed() >= maxElapsedMs) {
      return { attempts, elapsedMs: elapsed(), reason: "timeout", status: "exhausted", value };
    }
    if (attempts >= maxAttempts) {
      return { attempts, elapsedMs: elapsed(), reason: "attempts", status: "exhausted", value };
    }

    const visible = await waitForVisibility({ maxElapsedMs, now, signal, visibility });
    if (visible === "aborted") {
      return { attempts, elapsedMs: elapsed(), status: "cancelled", value };
    }
    if (visible === "timeout") {
      return { attempts, elapsedMs: elapsed(), reason: "timeout", status: "exhausted", value };
    }

    attempts += 1;
    value = await check(attempts);
    onPoll?.(attempts, value);

    if (isAborted(signal)) {
      return { attempts, elapsedMs: elapsed(), status: "cancelled", value };
    }
    if (isTerminal(value)) {
      return { attempts, elapsedMs: elapsed(), status: "terminal", value };
    }

    const remainingMs = maxElapsedMs - elapsed();
    if (remainingMs <= 0) {
      return { attempts, elapsedMs: elapsed(), reason: "timeout", status: "exhausted", value };
    }
    if (attempts >= maxAttempts) {
      return { attempts, elapsedMs: elapsed(), reason: "attempts", status: "exhausted", value };
    }

    const completed = await sleep(Math.min(delay, remainingMs), abortSignalOf(signal));
    if (!completed) {
      return { attempts, elapsedMs: elapsed(), status: "cancelled", value };
    }
    delay = nextBackoffDelay(delay, { maxDelayMs, multiplier });
  }
}

/** Schedules returned delays for display in tests and review evidence. */
export function pollSchedule({
  attempts,
  initialDelayMs = DEFAULT_POLL_SCHEDULE.initialDelayMs,
  maxDelayMs = DEFAULT_POLL_SCHEDULE.maxDelayMs,
  multiplier = DEFAULT_POLL_SCHEDULE.multiplier
}: {
  attempts: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  multiplier?: number;
}) {
  const delays: number[] = [];
  let delay = initialDelayMs;
  for (let index = 0; index < attempts; index += 1) {
    delays.push(delay);
    delay = nextBackoffDelay(delay, { maxDelayMs, multiplier });
  }
  return delays;
}

export function browserVisibility(): PollVisibility | undefined {
  if (typeof document === "undefined") return undefined;

  return {
    isHidden: () => document.visibilityState === "hidden",
    subscribe: (listener) => {
      document.addEventListener("visibilitychange", listener);
      return () => document.removeEventListener("visibilitychange", listener);
    }
  };
}

type VisibilityWait = "aborted" | "timeout" | "visible";

async function waitForVisibility({
  maxElapsedMs,
  now,
  signal,
  visibility
}: {
  maxElapsedMs: number;
  now: () => number;
  signal: AbortSignal | undefined;
  visibility: PollVisibility | undefined;
}): Promise<VisibilityWait> {
  if (visibility === undefined) return "visible";

  const waitingSince = now();
  while (visibility.isHidden()) {
    if (isAborted(signal)) return "aborted";
    if (now() - waitingSince >= maxElapsedMs) return "timeout";

    const remainingMs = Math.max(0, maxElapsedMs - (now() - waitingSince));
    const outcome = await waitForChange({
      signal,
      subscribe: visibility.subscribe,
      timeoutMs: remainingMs
    });
    if (outcome === "aborted") return "aborted";
    if (outcome === "timeout") return "timeout";
  }

  return "visible";
}

function waitForChange({
  signal,
  subscribe,
  timeoutMs
}: {
  signal: AbortSignal | undefined;
  subscribe: (listener: () => void) => () => void;
  timeoutMs: number;
}) {
  return new Promise<"aborted" | "changed" | "timeout">((resolve) => {
    let settled = false;
    const finish = (outcome: "aborted" | "changed" | "timeout") => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      signal?.removeEventListener("abort", onAbort);
      resolve(outcome);
    };
    const onAbort = () => finish("aborted");
    const timer = setTimeout(() => finish("timeout"), timeoutMs);
    const unsubscribe = subscribe(() => finish("changed"));
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function abortableSleep(delayMs: number, signal: AbortSignal) {
  if (signal.aborted) return Promise.resolve(false);

  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve(true);
    }, delayMs);
    const onAbort = () => {
      clearTimeout(timer);
      resolve(false);
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function isAborted(signal: AbortSignal | undefined) {
  return signal?.aborted === true;
}

function abortSignalOf(signal: AbortSignal | undefined) {
  return signal ?? new AbortController().signal;
}
