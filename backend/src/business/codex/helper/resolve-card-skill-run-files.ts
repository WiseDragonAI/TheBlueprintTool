/**
 * WHAT: Resolves one card-owned Codex run's durable summary, JSONL, and stderr files.
 * WHY: Cards can move between ledgers while their original run directory remains unchanged.
 */
import { basename, dirname, extname, isAbsolute, relative, resolve } from 'node:path';

type AnyRecord = Record<string, unknown>;

function safeSegment(value: unknown): string {
  return String(value || 'untitled').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
}

function isInside(parent: string, child: string): boolean {
  const inner = relative(parent, child);
  return Boolean(inner) && !inner.startsWith('..') && !isAbsolute(inner);
}

function ledgerStem(ledgerPath: string): string {
  return basename(ledgerPath, extname(ledgerPath));
}

export type CardSkillRunFiles = {
  runDirectory: string;
  outputFile: string;
  stdoutFile: string;
  stderrFile: string;
};

export function resolveCardSkillRunFiles(input: {
  ledger: AnyRecord;
  decisionOsRoot: string;
  ledgerPath: string;
  cardId: string;
  runId: string;
}): CardSkillRunFiles {
  const runRoot = resolve(input.decisionOsRoot, 'runs', 'codex-skills');
  const cards = Array.isArray(input.ledger.cards) ? input.ledger.cards as AnyRecord[] : [];
  const card = cards.find((entry) => String(entry.id ?? '') === input.cardId);
  const persistedOutputReference = String(card?.codexThreadRunOutputFile ?? card?.codexRunOutputFile ?? '').trim();
  const persistedOutputFile = persistedOutputReference
    ? resolve(input.decisionOsRoot, persistedOutputReference.replace(/^\.decision-os\//, ''))
    : '';
  const persistedRunDirectory = persistedOutputFile && isInside(runRoot, persistedOutputFile)
    ? dirname(persistedOutputFile)
    : '';
  const runDirectory = persistedRunDirectory || resolve(runRoot, safeSegment(ledgerStem(input.ledgerPath)));
  const runFileStem = safeSegment(input.runId);
  return {
    runDirectory,
    outputFile: resolve(runDirectory, `${runFileStem}.md`),
    stdoutFile: resolve(runDirectory, `${runFileStem}.jsonl`),
    stderrFile: resolve(runDirectory, `${runFileStem}.log`),
  };
}
