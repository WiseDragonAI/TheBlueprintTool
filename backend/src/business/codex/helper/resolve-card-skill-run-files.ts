/**
 * WHAT: Resolves one card-owned Codex run's durable summary, JSONL, and stderr files.
 * WHY: Cards can move between ledgers while their original run directory remains unchanged.
 */
import { existsSync, readdirSync } from 'node:fs';
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

function discoverLegacyRunDirectory(runRoot: string, runId: string): string {
  if (!existsSync(runRoot)) return '';
  const stem = safeSegment(runId);
  try {
    return readdirSync(runRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => resolve(runRoot, entry.name))
      .filter((directory) => existsSync(resolve(directory, `${stem}.md`)) || existsSync(resolve(directory, `${stem}.jsonl`)) || existsSync(resolve(directory, `${stem}.log`)))
      .sort()[0] ?? '';
  } catch {
    return '';
  }
}

export function indexCodexRunArtifactDirectories(decisionOsRoot: string): ReadonlyMap<string, string> {
  const runRoot = resolve(decisionOsRoot, 'runs', 'codex-skills');
  const index = new Map<string, string>();
  if (!existsSync(runRoot)) return index;
  try {
    const directories = readdirSync(runRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => resolve(runRoot, entry.name))
      .sort();
    for (const directory of directories) {
      for (const file of readdirSync(directory, { withFileTypes: true })) {
        if (!file.isFile()) continue;
        const extension = extname(file.name);
        if (extension !== '.md' && extension !== '.jsonl' && extension !== '.log') continue;
        const runId = basename(file.name, extension);
        if (runId && !index.has(runId)) index.set(runId, directory);
      }
    }
  } catch {
    return index;
  }
  return index;
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
  artifactDirectoryByRunId?: ReadonlyMap<string, string>;
}): CardSkillRunFiles {
  const runRoot = resolve(input.decisionOsRoot, 'runs', 'codex-skills');
  const cards = Array.isArray(input.ledger.cards) ? input.ledger.cards as AnyRecord[] : [];
  const card = cards.find((entry) => String(entry.id ?? '') === input.cardId);
  const persistedOutputFiles = card?.codexThreadRunOutputFiles && typeof card.codexThreadRunOutputFiles === 'object' && !Array.isArray(card.codexThreadRunOutputFiles)
    ? card.codexThreadRunOutputFiles as Record<string, unknown>
    : {};
  const persistedOutputReference = String(
    persistedOutputFiles[input.runId]
      ?? (String(card?.codexThreadRunId ?? '') === input.runId ? card?.codexThreadRunOutputFile : '')
      ?? card?.codexRunOutputFile
      ?? '',
  ).trim();
  const persistedOutputFile = persistedOutputReference
    ? resolve(input.decisionOsRoot, persistedOutputReference.replace(/^\.decision-os\//, ''))
    : '';
  const persistedRunDirectory = persistedOutputFile && isInside(runRoot, persistedOutputFile)
    ? dirname(persistedOutputFile)
    : '';
  const runDirectory = persistedRunDirectory
    || input.artifactDirectoryByRunId?.get(safeSegment(input.runId))
    || discoverLegacyRunDirectory(runRoot, input.runId)
    || resolve(runRoot, safeSegment(ledgerStem(input.ledgerPath)));
  const runFileStem = safeSegment(input.runId);
  return {
    runDirectory,
    outputFile: resolve(runDirectory, `${runFileStem}.md`),
    stdoutFile: resolve(runDirectory, `${runFileStem}.jsonl`),
    stderrFile: resolve(runDirectory, `${runFileStem}.log`),
  };
}
