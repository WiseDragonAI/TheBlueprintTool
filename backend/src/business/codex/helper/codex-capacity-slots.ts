/**
 * Reserves bounded Codex process capacity for work that runs outside the normal
 * persisted scheduler. Waiting callers remain cancellable and cannot wait forever.
 */
export type CodexSlotAcquireOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
};

type CapacitySlotOptions = {
  capacity: () => number;
  externalRunningCount: () => number;
  defaultTimeoutMs?: number;
  pollIntervalMs?: number;
};

function waitForCapacity(durationMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (): void => {
      if (timer) clearTimeout(timer);
      signal?.removeEventListener('abort', finish);
      resolve();
    };
    timer = setTimeout(finish, durationMs);
    signal?.addEventListener('abort', finish, { once: true });
  });
}

export function createCodexCapacitySlots(options: CapacitySlotOptions): {
  acquire: (acquireOptions?: CodexSlotAcquireOptions) => Promise<() => void>;
  reservedCount: () => number;
} {
  const defaultTimeoutMs = Math.max(1, options.defaultTimeoutMs ?? 10 * 60_000);
  const pollIntervalMs = Math.max(1, options.pollIntervalMs ?? 100);
  let reserved = 0;

  return {
    reservedCount: () => reserved,
    acquire: async (acquireOptions = {}) => {
      const timeoutMs = Math.max(1, acquireOptions.timeoutMs ?? defaultTimeoutMs);
      const deadline = Date.now() + timeoutMs;
      while (true) {
        if (acquireOptions.signal?.aborted) throw new Error('codex_slot_wait_cancelled');
        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0) throw new Error(`codex_slot_wait_timeout:${timeoutMs}`);

        const capacity = Math.max(1, options.capacity());
        if (options.externalRunningCount() + reserved < capacity) {
          reserved += 1;
          let released = false;
          return () => {
            if (released) return;
            released = true;
            reserved = Math.max(0, reserved - 1);
          };
        }
        await waitForCapacity(Math.min(pollIntervalMs, remainingMs), acquireOptions.signal);
      }
    },
  };
}
