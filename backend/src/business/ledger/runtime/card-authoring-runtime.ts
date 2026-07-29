/**
 * WHAT: Owns local card Markdown reads and durable card-content mutations.
 * WHY: HTTP routing must not coordinate task materialization, ledger persistence, revisions, and federation publication.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applyLedgerMutation, type LedgerMutation } from '../helper/apply-ledger-mutation.js';
import { readCanonicalDecisionOsState } from '../helper/read-canonical-decision-os-state.js';
import { ledgerCardProjection } from '../../server/helper/ledger-read-models.js';
import { tasksLedgerId, type DecisionOsProject } from '../../server/helper/project-catalog.js';
import { materializeTaskMutationInputs } from '../../federation/helper/materialize-task-mutation-inputs.js';
import type { FederationContentReplicaStore } from '../../federation/helper/federation-content-replica-store.js';
import type { ProjectTaskState } from '../../task-state/helper/project-task-state.js';
import type { LedgerCardPatchReceipt } from '../controller/save-ledger-card-content-controller.js';

type AnyRecord = Record<string, unknown>;

type ProjectWatcher = {
  ignoreNext(file: string): void;
  refreshOwnership(): void;
};

type RevisionTracker = {
  advance(ledgerId: string): number;
};

export function createCardAuthoringRuntime(input: {
  contentDrain: (() => Promise<void>) | null;
  contentStore: FederationContentReplicaStore;
  decisionOsRoot: string;
  invalidateProject(projectId: string, changes?: readonly unknown[]): void;
  localProject: DecisionOsProject | null;
  publishContentChange(): void;
  revisions: RevisionTracker;
  stateForProject(project: DecisionOsProject): ProjectTaskState;
  watcher: ProjectWatcher;
}) {
  const loadLedger = (ledgerId: string): { ledger: AnyRecord; ledgerPath: string } | null => {
    const registered = readCanonicalDecisionOsState({
      action_payload: { decisionOsFile: resolve(input.decisionOsRoot, 'state.json') },
    }).ledgers.find((entry) => entry.id === ledgerId);
    if (!registered) return null;
    const ledgerPath = resolve(
      input.decisionOsRoot,
      registered.ledgerFile.replace(/^\.decision-os\//, ''),
    );
    if (ledgerId === tasksLedgerId && input.localProject) {
      return {
        ledger: structuredClone(input.stateForProject(input.localProject).projection().ledger),
        ledgerPath,
      };
    }
    if (!existsSync(ledgerPath)) return null;
    return {
      ledger: JSON.parse(readFileSync(ledgerPath, 'utf8')) as AnyRecord,
      ledgerPath,
    };
  };

  const patchCard = async (patch: {
    cardId: string;
    ledgerId: string;
    markdown: string;
    mutationId: string;
  }): Promise<LedgerCardPatchReceipt> => {
    if (!input.localProject) throw new Error('The card is not locally owned.');
    const latest = loadLedger(patch.ledgerId);
    if (!latest) throw new Error('The ledger disappeared before the card mutation.');
    const before = structuredClone(latest.ledger);
    const after = structuredClone(latest.ledger);
    const mutation: LedgerMutation = {
      action: 'patch-card',
      mutationId: patch.mutationId,
      cardPatch: { id: patch.cardId, description: patch.markdown },
    };
    if (patch.ledgerId === tasksLedgerId) {
      await materializeTaskMutationInputs({
        projectId: input.localProject.id,
        decisionOsRoot: input.decisionOsRoot,
        ledger: before,
        mutation,
        store: input.stateForProject(input.localProject).store,
        contentStore: input.contentStore,
        drain: input.contentDrain,
      });
    }
    const applied = applyLedgerMutation({
      decisionOsRoot: input.decisionOsRoot,
      ledgerPath: latest.ledgerPath,
      ledger: after,
      mutation,
    });
    if (applied.error) {
      throw new Error(String(applied.error.body.error ?? 'The card mutation was rejected.'));
    }
    if (patch.ledgerId === tasksLedgerId) {
      const state = input.stateForProject(input.localProject);
      const committed = await state.executeMutation(
        mutation,
        before,
        after,
        applied.changedContentFiles,
      );
      if (committed.changed) {
        input.invalidateProject(input.localProject.id, committed.localChanges);
      }
      const taskClock = state.store.clientClock();
      return {
        changedCard: ledgerCardProjection({
          decisionOsRoot: input.decisionOsRoot,
          ledgerId: patch.ledgerId,
          ledger: committed.ledger,
          cardId: patch.cardId,
        }),
        taskClock,
        receipt: {
          mutationId: patch.mutationId,
          clock: taskClock,
          entities: committed.localChanges,
        },
      };
    }
    input.watcher.ignoreNext(latest.ledgerPath);
    writeFileSync(latest.ledgerPath, JSON.stringify(after, null, 2));
    input.watcher.refreshOwnership();
    input.invalidateProject(input.localProject.id);
    input.publishContentChange();
    input.revisions.advance(patch.ledgerId);
    return {
      changedCard: ledgerCardProjection({
        decisionOsRoot: input.decisionOsRoot,
        ledgerId: patch.ledgerId,
        ledger: after,
        cardId: patch.cardId,
      }),
    };
  };

  return { loadLedger, patchCard };
}
