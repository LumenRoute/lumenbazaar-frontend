import { describe, expect, it, vi } from "vitest";

import { nextBackoffDelay, pollSchedule, pollWithBackoff } from "./polling";

function clock(start: number) {
  const state = { now: start };
  return {
    now: () => state.now,
    sleep: async (delayMs: number) => {
      state.now += delayMs;
      return true;
    },
    state
  };
}

describe("pollWithBackoff", () => {
  it("stops at the first terminal value and reports attempts", async () => {
    const time = clock(0);
    const check = vi.fn(async (attempt: number) => attempt);

    const result = await pollWithBackoff({
      check,
      isTerminal: (value) => value === 3,
      maxAttempts: 8,
      now: time.now,
      sleep: time.sleep
    });

    expect(result).toMatchObject({ attempts: 3, status: "terminal", value: 3 });
    expect(check).toHaveBeenCalledTimes(3);
  });

  it("follows an exponential schedule with a ceiling", async () => {
    const delays: number[] = [];
    const time = clock(0);

    await pollWithBackoff({
      check: async () => null,
      initialDelayMs: 100,
      isTerminal: () => false,
      maxAttempts: 5,
      maxDelayMs: 400,
      now: time.now,
      sleep: async (delayMs) => {
        delays.push(delayMs);
        time.state.now += delayMs;
        return true;
      }
    });

    expect(delays).toEqual([100, 200, 400, 400]);
  });

  it("exhausts on the attempt limit and on the elapsed budget", async () => {
    const time = clock(0);
    const attempts = await pollWithBackoff({
      check: async () => null,
      initialDelayMs: 1,
      isTerminal: () => false,
      maxAttempts: 3,
      now: time.now,
      sleep: time.sleep
    });

    expect(attempts).toMatchObject({ attempts: 3, reason: "attempts", status: "exhausted" });

    const elapsed = await pollWithBackoff({
      check: async () => null,
      initialDelayMs: 1_000,
      isTerminal: () => false,
      maxAttempts: 99,
      maxElapsedMs: 1_500,
      now: time.now,
      sleep: time.sleep
    });

    expect(elapsed).toMatchObject({ reason: "timeout", status: "exhausted" });
  });

  it("cancels without further checks when aborted", async () => {
    const controller = new AbortController();
    const check = vi.fn(async () => null);
    controller.abort();

    const result = await pollWithBackoff({
      check,
      isTerminal: () => false,
      signal: controller.signal
    });

    expect(result).toMatchObject({ attempts: 0, status: "cancelled" });
    expect(check).not.toHaveBeenCalled();
  });

  it("pauses while the gate is blocked and resumes afterwards", async () => {
    let blocked = true;
    const listeners = new Set<() => void>();
    const time = clock(0);
    const check = vi.fn(async () => "done");

    const pending = pollWithBackoff({
      check,
      isTerminal: () => true,
      maxAttempts: 2,
      now: time.now,
      sleep: time.sleep,
      visibility: {
        isHidden: () => blocked,
        subscribe: (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        }
      }
    });

    expect(check).not.toHaveBeenCalled();
    blocked = false;
    for (const listener of listeners) listener();

    await expect(pending).resolves.toMatchObject({ attempts: 1, status: "terminal" });
  });
});

describe("schedule helpers", () => {
  it("computes capped delays", () => {
    expect(nextBackoffDelay(500, {})).toBe(1_000);
    expect(nextBackoffDelay(6_000, {})).toBe(8_000);
    expect(pollSchedule({ attempts: 4 })).toEqual([500, 1_000, 2_000, 4_000]);
  });
});
