/**
 * WHAT: Serializes persistence while replaying every pending deterministic ledger mutation over confirmed state.
 * WHY: Immediate UI updates must survive stale refreshes and rejected requests without promoting unconfirmed state.
 */

export type OptimisticLedgerPersistenceResult<Ledger> =
  | { ok: true; confirmed?: Ledger }
  | { ok: false; error?: unknown };

export type OptimisticLedgerTransactionInput<Ledger, Mutation> = {
  scope: string;
  mutation: Mutation;
  apply: (ledger: Ledger) => void;
  render?: (outcome: 'optimistic' | 'confirmed' | 'rejected') => void;
  onRejected?: (error: unknown) => void;
};

type PendingTransaction<Ledger, Mutation> = OptimisticLedgerTransactionInput<Ledger, Mutation> & { sequence: number };
type ScopeState<Ledger, Mutation> = {
  base: Ledger;
  pending: PendingTransaction<Ledger, Mutation>[];
  tail: Promise<void>;
};

export function createOptimisticLedgerTransactionCoordinator<Ledger, Mutation>(input: {
  read: () => Ledger | null;
  write: (ledger: Ledger, scope: string) => void;
  clone?: (ledger: Ledger) => Ledger;
  persist: (scope: string, mutation: Mutation) => Promise<OptimisticLedgerPersistenceResult<Ledger>>;
  isScopeActive?: (scope: string) => boolean;
}) {
  const clone = input.clone ?? ((ledger: Ledger) => structuredClone(ledger));
  const scopes = new Map<string, ScopeState<Ledger, Mutation>>();
  let nextSequence = 1;

  const replay = (scope: ScopeState<Ledger, Mutation>): Ledger => {
    const ledger = clone(scope.base);
    for (const transaction of scope.pending) transaction.apply(ledger);
    return ledger;
  };

  const writeIfActive = (scopeKey: string, ledger: Ledger): void => {
    if (input.isScopeActive && !input.isScopeActive(scopeKey)) return;
    input.write(ledger, scopeKey);
  };

  const scopeState = (scopeKey: string): ScopeState<Ledger, Mutation> | null => {
    const current = scopes.get(scopeKey);
    if (current) return current;
    const ledger = input.read();
    if (!ledger) return null;
    const created = { base: clone(ledger), pending: [], tail: Promise.resolve() };
    scopes.set(scopeKey, created);
    return created;
  };

  const settle = (
    scopeKey: string,
    scope: ScopeState<Ledger, Mutation>,
    transaction: PendingTransaction<Ledger, Mutation>,
    result: OptimisticLedgerPersistenceResult<Ledger>,
  ): boolean => {
    const index = scope.pending.findIndex((candidate) => candidate.sequence === transaction.sequence);
    if (index < 0) return result.ok;
    if (result.ok) {
      scope.base = result.confirmed ? clone(result.confirmed) : (() => {
        const next = clone(scope.base);
        transaction.apply(next);
        return next;
      })();
    }
    scope.pending.splice(index, 1);
    writeIfActive(scopeKey, replay(scope));
    transaction.render?.(result.ok ? 'confirmed' : 'rejected');
    if (result.ok === false) transaction.onRejected?.(result.error);
    if (scope.pending.length === 0) scopes.delete(scopeKey);
    return result.ok;
  };

  return {
    run(transactionInput: OptimisticLedgerTransactionInput<Ledger, Mutation>): Promise<boolean> {
      const scope = scopeState(transactionInput.scope);
      if (!scope) return Promise.resolve(false);
      const transaction = { ...transactionInput, sequence: nextSequence++ };
      scope.pending.push(transaction);
      writeIfActive(transaction.scope, replay(scope));
      transaction.render?.('optimistic');

      const persistence = scope.tail.then(async () => {
        let result: OptimisticLedgerPersistenceResult<Ledger>;
        try {
          result = await input.persist(transaction.scope, transaction.mutation);
        } catch (error) {
          result = { ok: false, error };
        }
        return settle(transaction.scope, scope, transaction, result);
      });
      scope.tail = persistence.then(() => undefined, () => undefined);
      return persistence;
    },

    reconcile(scopeKey: string, confirmed: Ledger): Ledger {
      const scope = scopes.get(scopeKey);
      if (!scope) return confirmed;
      scope.base = clone(confirmed);
      return replay(scope);
    },

    pendingCount(scopeKey: string): number {
      return scopes.get(scopeKey)?.pending.length ?? 0;
    },
  };
}
