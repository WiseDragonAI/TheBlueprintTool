/**
 * WHAT: Serializes Codex admission for one project ledger card.
 * WHY: Thread, continuation, direct, and pipeline requests must not observe and claim the same empty lease concurrently.
 */

const tails = new Map<string, Promise<void>>();

function admissionKey(input: { decisionOsRoot: string; ledgerId: string; cardId: string }): string {
  return `${input.decisionOsRoot}\u0000${input.ledgerId}\u0000${input.cardId}`;
}

export async function withCardCodexAdmission<T>(
  input: { decisionOsRoot: string; ledgerId: string; cardId: string },
  operation: () => Promise<T>,
): Promise<T> {
  const key = admissionKey(input);
  const previous = tails.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const tail = previous.then(() => current);
  tails.set(key, tail);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    // WHAT: Remove only the tail still owned by this completed operation.
    // WHY: A later waiter must retain the key until its own operation settles.
    if (tails.get(key) === tail) void tail.then(() => {
      if (tails.get(key) === tail) tails.delete(key);
    });
  }
}

export function activeCardCodexAdmissionCount(): number {
  return tails.size;
}
