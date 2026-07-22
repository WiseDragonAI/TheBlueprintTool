/**
 * WHAT: Migrates durable Codex ownership to exact execution leases and per-run artifact references.
 * WHY: Legacy active pointers and collapsed output paths must not survive startup as false runtime authority.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { readCanonicalDecisionOsState } from '../../ledger/helper/read-canonical-decision-os-state.js';
import { stripHydratedThreadNotes } from '../../ledger/helper/thread-content-file.js';
import { readCodexPipelineStore } from './codex-pipeline-store.js';
import { readCodexProcessQueue } from './codex-process-queue.js';
import { projectCardExecutionIntent } from './project-card-execution-intent.js';
import { indexCodexRunArtifactDirectories, resolveCardSkillRunFiles } from './resolve-card-skill-run-files.js';
import { persistLedgerProjection } from '../../task-state/helper/persist-ledger-projection.js';
import { readLedgerProjection } from '../../task-state/helper/read-ledger-projection.js';

type AnyRecord = Record<string, unknown>;
export type CodexOwnershipReconciliation = {
  ledgersChanged: number;
  leasesCleared: number;
  intentsSettled: number;
  artifactMappingsAdded: number;
};

const activeIntentStates = new Set(['waiting', 'queued', 'running']);
const unrecoverableIntentError = 'Execution ownership was not recoverable during startup.';

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function activePipelineExecutions(decisionOsRoot: string): { executions: Set<string>; cards: Set<string> } {
  const executions = new Set<string>();
  const cards = new Set<string>();
  for (const run of readCodexPipelineStore({ decisionOsRoot }).store.runs) {
    if (run.status !== 'pending' && run.status !== 'running') continue;
    for (const step of run.steps) for (const skill of step.skills) {
      if (skill.status !== 'pending' && skill.status !== 'running') continue;
      for (const cardId of [run.sourceCardId, step.outputCardId]) {
        executions.add([run.ledgerId, cardId, skill.runId, skill.executionId].join('\0'));
        cards.add([run.ledgerId, cardId].join('\0'));
      }
    }
  }
  return { executions, cards };
}

export async function reconcileCodexExecutionOwnership(input: { decisionOsRoot: string; runtime?: AnyRecord }): Promise<CodexOwnershipReconciliation> {
  const result: CodexOwnershipReconciliation = { ledgersChanged: 0, leasesCleared: 0, intentsSettled: 0, artifactMappingsAdded: 0 };
  const state = readCanonicalDecisionOsState({
    action_payload: { decisionOsFile: resolve(input.decisionOsRoot, 'state.json') },
    runtime_state: input.runtime ?? {},
  });
  const queueEntries = readCodexProcessQueue(input.decisionOsRoot);
  const queueOwned = new Set(queueEntries.map((item) => [
    text(item.payload.ledgerId), text(item.payload.cardId), text(item.payload.runId || item.id), text(item.payload.executionId),
  ].join('\0')));
  const queueOwnedCards = new Set(queueEntries.map((item) => [text(item.payload.ledgerId), text(item.payload.cardId)].join('\0')));
  const pipelineOwned = activePipelineExecutions(input.decisionOsRoot);
  const artifactDirectoryByRunId = indexCodexRunArtifactDirectories(input.decisionOsRoot);
  const runtimeRuns = input.runtime?.codexSkillRuns && typeof input.runtime.codexSkillRuns === 'object'
    ? input.runtime.codexSkillRuns as Record<string, AnyRecord>
    : {};

  for (const entry of state.ledgers) {
    const ledgerRef = text(entry.ledgerFile).replace(/^\.decision-os\//, '');
    const ledgerPath = resolve(input.decisionOsRoot, ledgerRef);
    if (!ledgerRef || !existsSync(ledgerPath)) continue;
    const ledger = readLedgerProjection({ ledgerId: entry.id, ledgerPath, runtime: input.runtime }) as AnyRecord & { cards?: AnyRecord[] };
    let changed = false;
    const changedCardIds = new Set<string>();
    for (const card of ledger.cards ?? []) {
      const cardId = text(card.id);
      let cardChanged = false;
      if (card.executionStatus !== undefined) { delete card.executionStatus; changed = true; cardChanged = true; }
      if (card.executionRunId !== undefined) { delete card.executionRunId; changed = true; cardChanged = true; }
      const activeRunId = text(card.codexActiveRunId);
      const activeExecutionId = text(card.codexActiveExecutionId);
      const executionKey = [entry.id, cardId, activeRunId, activeExecutionId].join('\0');
      const cardKey = [entry.id, cardId].join('\0');
      const runtimeRun = runtimeRuns[activeRunId];
      const runtimeOwns = Boolean(activeRunId && activeExecutionId
        && text(runtimeRun?.executionId) === activeExecutionId
        && (runtimeRun?.status === 'pending' || runtimeRun?.status === 'running'));
      const exactExecutionOwned = Boolean(activeRunId && activeExecutionId
        && (queueOwned.has(executionKey) || pipelineOwned.executions.has(executionKey) || runtimeOwns));
      const cardExecutionOwned = exactExecutionOwned || queueOwnedCards.has(cardKey) || pipelineOwned.cards.has(cardKey);
      if (activeRunId || activeExecutionId) {
        if (!exactExecutionOwned) {
          delete card.codexActiveRunId;
          delete card.codexActiveExecutionId;
          result.leasesCleared += 1;
          changed = true;
          cardChanged = true;
        }
      }
      const executionIntent = card.executionIntent && typeof card.executionIntent === 'object' && !Array.isArray(card.executionIntent)
        ? card.executionIntent as AnyRecord
        : null;
      if (executionIntent && activeIntentStates.has(text(executionIntent.state)) && !cardExecutionOwned) {
        projectCardExecutionIntent({
          card,
          intentId: text(executionIntent.id) || activeRunId || `startup-recovery:${cardId}`,
          state: 'failed',
          error: unrecoverableIntentError,
        });
        result.intentsSettled += 1;
        changed = true;
        cardChanged = true;
      }

      const threadRunIds = Array.isArray(card.codexThreadRunIds) ? card.codexThreadRunIds.map(text).filter(Boolean) : [];
      const currentThreadRunId = text(card.codexThreadRunId);
      const outputFiles = card.codexThreadRunOutputFiles && typeof card.codexThreadRunOutputFiles === 'object' && !Array.isArray(card.codexThreadRunOutputFiles)
        ? { ...card.codexThreadRunOutputFiles as Record<string, unknown> }
        : {};
      for (const runId of new Set([...threadRunIds, currentThreadRunId].filter(Boolean))) {
        if (text(outputFiles[runId])) continue;
        const files = resolveCardSkillRunFiles({ ledger, decisionOsRoot: input.decisionOsRoot, ledgerPath, cardId, runId, artifactDirectoryByRunId });
        if (!existsSync(files.outputFile)) continue;
        outputFiles[runId] = relative(dirname(input.decisionOsRoot), files.outputFile);
        result.artifactMappingsAdded += 1;
        changed = true;
        cardChanged = true;
      }
      if (Object.keys(outputFiles).length > 0) card.codexThreadRunOutputFiles = outputFiles;
      if (cardChanged && cardId) changedCardIds.add(cardId);
    }
    if (!changed) continue;
    stripHydratedThreadNotes(ledger);
    await persistLedgerProjection({
      decisionOsRoot: input.decisionOsRoot,
      ledgerId: entry.id,
      ledgerPath,
      ledger,
      runtime: input.runtime ?? {},
      command: { kind: 'reconcile-codex-ownership', cardIds: [...changedCardIds] },
    });
    result.ledgersChanged += 1;
  }
  return result;
}
