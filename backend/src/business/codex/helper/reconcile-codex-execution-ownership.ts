/**
 * WHAT: Migrates durable Codex ownership to exact execution leases and per-run artifact references.
 * WHY: Legacy active pointers and collapsed output paths must not survive startup as false runtime authority.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { readCanonicalDecisionOsState } from '../../ledger/helper/read-canonical-decision-os-state.js';
import { stripHydratedThreadNotes } from '../../ledger/helper/thread-content-file.js';
import { readCodexPipelineStore } from './codex-pipeline-store.js';
import { readCodexProcessQueue } from './codex-process-queue.js';
import { resolveCardSkillRunFiles } from './resolve-card-skill-run-files.js';

type AnyRecord = Record<string, unknown>;
export type CodexOwnershipReconciliation = { ledgersChanged: number; leasesCleared: number; artifactMappingsAdded: number };

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function activePipelineExecutions(decisionOsRoot: string): Set<string> {
  const owned = new Set<string>();
  for (const run of readCodexPipelineStore({ decisionOsRoot }).store.runs) {
    if (run.status !== 'pending' && run.status !== 'running') continue;
    for (const step of run.steps) for (const skill of step.skills) {
      if (skill.status !== 'pending' && skill.status !== 'running') continue;
      for (const cardId of [run.sourceCardId, step.outputCardId]) owned.add([run.ledgerId, cardId, skill.runId, skill.executionId].join('\0'));
    }
  }
  return owned;
}

export function reconcileCodexExecutionOwnership(input: { decisionOsRoot: string; runtime?: AnyRecord }): CodexOwnershipReconciliation {
  const result: CodexOwnershipReconciliation = { ledgersChanged: 0, leasesCleared: 0, artifactMappingsAdded: 0 };
  const state = readCanonicalDecisionOsState({
    action_payload: { decisionOsFile: resolve(input.decisionOsRoot, 'state.json') },
    runtime_state: input.runtime ?? {},
  });
  const queueOwned = new Set(readCodexProcessQueue(input.decisionOsRoot).map((item) => [
    text(item.payload.ledgerId), text(item.payload.cardId), text(item.payload.runId || item.id), text(item.payload.executionId),
  ].join('\0')));
  const pipelineOwned = activePipelineExecutions(input.decisionOsRoot);
  const runtimeRuns = input.runtime?.codexSkillRuns && typeof input.runtime.codexSkillRuns === 'object'
    ? input.runtime.codexSkillRuns as Record<string, AnyRecord>
    : {};

  for (const entry of state.ledgers) {
    const ledgerRef = text(entry.ledgerFile).replace(/^\.decision-os\//, '');
    const ledgerPath = resolve(input.decisionOsRoot, ledgerRef);
    if (!ledgerRef || !existsSync(ledgerPath)) continue;
    const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as AnyRecord & { cards?: AnyRecord[] };
    let changed = false;
    for (const card of ledger.cards ?? []) {
      if (card.executionStatus !== undefined) { delete card.executionStatus; changed = true; }
      if (card.executionRunId !== undefined) { delete card.executionRunId; changed = true; }
      const cardId = text(card.id);
      const activeRunId = text(card.codexActiveRunId);
      const activeExecutionId = text(card.codexActiveExecutionId);
      if (activeRunId || activeExecutionId) {
        const key = [entry.id, cardId, activeRunId, activeExecutionId].join('\0');
        const runtimeRun = runtimeRuns[activeRunId];
        const runtimeOwns = Boolean(activeRunId && activeExecutionId
          && text(runtimeRun?.executionId) === activeExecutionId
          && (runtimeRun?.status === 'pending' || runtimeRun?.status === 'running'));
        if (!activeRunId || !activeExecutionId || (!queueOwned.has(key) && !pipelineOwned.has(key) && !runtimeOwns)) {
          delete card.codexActiveRunId;
          delete card.codexActiveExecutionId;
          result.leasesCleared += 1;
          changed = true;
        }
      }

      const threadRunIds = Array.isArray(card.codexThreadRunIds) ? card.codexThreadRunIds.map(text).filter(Boolean) : [];
      const currentThreadRunId = text(card.codexThreadRunId);
      const outputFiles = card.codexThreadRunOutputFiles && typeof card.codexThreadRunOutputFiles === 'object' && !Array.isArray(card.codexThreadRunOutputFiles)
        ? { ...card.codexThreadRunOutputFiles as Record<string, unknown> }
        : {};
      for (const runId of new Set([...threadRunIds, currentThreadRunId].filter(Boolean))) {
        if (text(outputFiles[runId])) continue;
        const files = resolveCardSkillRunFiles({ ledger, decisionOsRoot: input.decisionOsRoot, ledgerPath, cardId, runId });
        if (!existsSync(files.outputFile)) continue;
        outputFiles[runId] = relative(dirname(input.decisionOsRoot), files.outputFile);
        result.artifactMappingsAdded += 1;
        changed = true;
      }
      if (Object.keys(outputFiles).length > 0) card.codexThreadRunOutputFiles = outputFiles;
    }
    if (!changed) continue;
    stripHydratedThreadNotes(ledger);
    writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
    result.ledgersChanged += 1;
  }
  return result;
}
