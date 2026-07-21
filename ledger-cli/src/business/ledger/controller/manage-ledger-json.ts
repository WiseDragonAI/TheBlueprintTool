/**
 * WHAT: Ledger JSON command controller.
 * WHY: ledger edits must use committed ledger files as the work surface.
 */
import type { FileSystemPort, Result } from '../../../lib/types.js';
import { dirname, resolve } from 'node:path';
import { constants, existsSync, accessSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { telemetry } from '../../../lib/telemetry/telemetry.js';
import { readLedgerJson } from '../helper/read-ledger-json.js';
import { writeLedgerJson } from '../effect/write-ledger-json.js';
import { transitionCardLifecycle } from '../effect/transition-card-lifecycle.js';
import { appendTaskThreadAnswer } from '../effect/append-task-thread-answer.js';
import { isWorkerOwnedTaskLedger } from '../helper/is-worker-owned-task-ledger.js';
import { formatLedgerOverview } from '../helper/format-ledger-overview.js';
import { formatLedgerMarkdownExport } from '../helper/format-ledger-markdown-export.js';
import { appendThreadAnswer } from '../helper/append-thread-answer.js';
import { findUnansweredThreads } from '../helper/find-unanswered-threads.js';
import { formatUnansweredThreads } from '../helper/format-unanswered-threads.js';
import { resolveLedgerCardContext, resolveLedgerZoneCardsContext } from '../helper/resolve-ledger-zone-context.js';
import { hydrateLedgerCardContent, writeCardCommentContent } from '../helper/card-content-file.js';
import { formatMasterTaskValidation, validateMasterTasks } from '../helper/validate-master-tasks.js';
import { hydrateLedgerThreadNotesFor, stripHydratedThreadNotes } from '../helper/thread-content-file.js';
import { resolveMasterTaskGate, resolveSessionContext } from '../helper/resolve-session-context.js';

type JsonObject = Record<string, unknown>;

function isRecord(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validQuestionnaires(value: unknown): value is Record<string, { contextRevision: string; responses: Record<string, { status: string }> }> {
  if (!isRecord(value)) return false;
  for (const [questionnaireId, questionnaireValue] of Object.entries(value)) {
    if (!/^[A-Za-z0-9._-]+$/.test(questionnaireId) || !isRecord(questionnaireValue) || questionnaireValue.version !== 1 || typeof questionnaireValue.contextRevision !== 'string' || !questionnaireValue.contextRevision.trim() || !Array.isArray(questionnaireValue.questions) || !isRecord(questionnaireValue.responses)) return false;
    const questionIds = new Set<string>();
    for (const questionValue of questionnaireValue.questions) {
      if (!isRecord(questionValue) || typeof questionValue.id !== 'string' || !questionValue.id.trim() || questionIds.has(questionValue.id) || typeof questionValue.question !== 'string' || typeof questionValue.placeholder !== 'string' || !Array.isArray(questionValue.choices) || questionValue.choices.length !== 4) return false;
      questionIds.add(questionValue.id);
      if (questionValue.choices.some((choice) => !isRecord(choice) || typeof choice.emoji !== 'string' || typeof choice.text !== 'string' || !choice.text.trim())) return false;
    }
    if (questionnaireValue.currentQuestionId !== undefined && (typeof questionnaireValue.currentQuestionId !== 'string' || !questionIds.has(questionnaireValue.currentQuestionId))) return false;
    for (const [questionId, response] of Object.entries(questionnaireValue.responses)) {
      if (!questionIds.has(questionId) || !isRecord(response) || !['answered', 'rejected', 'skipped', 'pending'].includes(String(response.status)) || typeof response.updatedAt !== 'string') return false;
      if (response.choiceIndex !== undefined && (!Number.isInteger(Number(response.choiceIndex)) || Number(response.choiceIndex) < 0 || Number(response.choiceIndex) > 3)) return false;
      if (response.customAnswer !== undefined && typeof response.customAnswer !== 'string') return false;
    }
  }
  return true;
}

function revisedQuestionnairesCarryAnswers(previous: unknown, next: Record<string, { contextRevision: string; responses: Record<string, { status: string }> }>): boolean {
  if (!isRecord(previous)) return false;
  for (const [questionnaireId, questionnaire] of Object.entries(next)) {
    const prior = previous[questionnaireId];
    if (!isRecord(prior) || String(prior.contextRevision ?? '') === questionnaire.contextRevision) continue;
    if (Object.values(questionnaire.responses).some((response) => response.status !== 'pending')) return true;
  }
  return false;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function primaryCheckoutRoot(workspaceRoot: string): string {
  try {
    const common = String(execFileSync('git', ['-C', workspaceRoot, 'rev-parse', '--git-common-dir'], { encoding: 'utf8' })).trim();
    return dirname(resolve(workspaceRoot, common));
  } catch { return workspaceRoot; }
}

async function applyLedgerMutationOperation(
  ledger: unknown,
  operation: {
    addCardFile?: string;
    addRelationships?: Array<{
      from?: string;
      id?: string;
      label?: string;
      to?: string;
    }>;
    cardComment?: string;
    cardCommentFile?: string;
    cardQuestionnairesFile?: string;
    cardH?: number;
    cardId?: string;
    cardLabels?: string[];
    cardTitle?: string;
    cardW?: number;
    cardX?: number;
    cardY?: number;
    removeCardIds?: string[];
    removeRelationshipIds?: string[];
  } | undefined,
  ledgerJsonFile: string,
  fs?: FileSystemPort,
): Promise<Result<unknown>> {
  const hasCardLabels = (operation?.cardLabels ?? []).length > 0;
  const hasCardLayout = operation?.cardX !== undefined || operation?.cardY !== undefined || operation?.cardW !== undefined || operation?.cardH !== undefined;
  if (!operation || (!operation.addCardFile && operation.cardComment === undefined && !operation.cardCommentFile && !operation.cardQuestionnairesFile && !operation.cardId && !operation.cardTitle && !hasCardLabels && !hasCardLayout && (operation.removeCardIds ?? []).length === 0 && (operation.removeRelationshipIds ?? []).length === 0 && (operation.addRelationships ?? []).length === 0)) {
    return { ok: true, value: ledger };
  }

  if (!isRecord(ledger)) {
    return { ok: false, error: 'Ledger mutation operations require an object ledger.' };
  }

  const nextLedger: JsonObject = {
    ...ledger,
    cards: Array.isArray(ledger.cards) ? ledger.cards.map((card) => (isRecord(card) ? { ...card } : card)) : [],
    relationships: Array.isArray(ledger.relationships) ? ledger.relationships.map((relationship) => (isRecord(relationship) ? { ...relationship } : relationship)) : [],
  };

  if (operation.addCardFile) {
    const cardText = await (fs ? fs.readFile(operation.addCardFile) : readFileWithNode(operation.addCardFile));
    let card: unknown;
    try {
      card = JSON.parse(cardText);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Invalid card JSON.' };
    }

    if (!isRecord(card) || typeof card.id !== 'string') {
      return { ok: false, error: 'Card mutation requires a JSON object with an id.' };
    }

    const cards = nextLedger.cards as unknown[];
    nextLedger.cards = cards.filter((entry) => !isRecord(entry) || entry.id !== card.id).concat(card);
  }

  const removeCardIds = new Set(operation.removeCardIds ?? []);
  if (removeCardIds.size > 0) {
    nextLedger.cards = (nextLedger.cards as unknown[]).filter((card) => {
      return !isRecord(card) || !removeCardIds.has(String(card.id ?? ''));
    });
    nextLedger.relationships = (nextLedger.relationships as unknown[]).filter((relationship) => {
      if (!isRecord(relationship)) return true;
      const from = String(relationship.from ?? '');
      const to = String(relationship.to ?? '');
      return !removeCardIds.has(from) && !removeCardIds.has(to);
    });
  }

  if (operation.cardComment !== undefined || operation.cardCommentFile || operation.cardQuestionnairesFile || operation.cardTitle || hasCardLabels || hasCardLayout || operation.cardId) {
    if (!operation.cardId) {
      return { ok: false, error: 'Card mutation requires --card-id.' };
    }

    const cards = nextLedger.cards as unknown[];
    const card = cards.find((entry) => isRecord(entry) && entry.id === operation.cardId);
    if (!isRecord(card)) {
      return { ok: false, error: `Card not found: ${operation.cardId}` };
    }

    if (operation.cardTitle) {
      card.title = operation.cardTitle;
    }

    if (operation.cardX !== undefined) card.x = operation.cardX;
    if (operation.cardY !== undefined) card.y = operation.cardY;
    if (operation.cardW !== undefined) card.w = operation.cardW;
    if (operation.cardH !== undefined) card.h = operation.cardH;

    if (hasCardLabels) {
      const labels = (operation.cardLabels ?? []).map((label) => String(label).trim()).filter(Boolean);
      if (labels.length > 0) card.labels = labels;
      else delete card.labels;
    }

    if (operation.cardComment !== undefined || operation.cardCommentFile) {
      const commentText = operation.cardComment ?? await (fs ? fs.readFile(operation.cardCommentFile ?? '') : readFileWithNode(operation.cardCommentFile ?? ''));
      await writeCardCommentContent({ card, content: commentText, fs, ledgerJsonFile });
    }

    if (operation.cardQuestionnairesFile) {
      const questionnaireText = await (fs ? fs.readFile(operation.cardQuestionnairesFile) : readFileWithNode(operation.cardQuestionnairesFile));
      let questionnaires: unknown;
      try {
        questionnaires = JSON.parse(questionnaireText);
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Invalid questionnaire JSON.' };
      }
      if (!validQuestionnaires(questionnaires)) return { ok: false, error: 'Card questionnaires must use the supported versioned question and response contract.' };
      if (revisedQuestionnairesCarryAnswers(card.questionnaires, questionnaires)) return { ok: false, error: 'Changing a questionnaire context revision requires clearing its prior answers.' };
      card.questionnaires = questionnaires;
    }
  }

  const removeRelationshipIds = new Set(operation.removeRelationshipIds ?? []);
  if (removeRelationshipIds.size > 0) {
    nextLedger.relationships = (nextLedger.relationships as unknown[]).filter((relationship) => {
      return !isRecord(relationship) || !removeRelationshipIds.has(String(relationship.id ?? ''));
    });
  }

  for (const relationship of operation.addRelationships ?? []) {
    if (!relationship.id || !relationship.from || !relationship.to) {
      return { ok: false, error: 'Relationship mutation requires id, from, and to.' };
    }

    const relationships = nextLedger.relationships as unknown[];
    const withoutExisting = relationships.filter((entry) => !isRecord(entry) || entry.id !== relationship.id);
    withoutExisting.push({
      id: relationship.id,
      from: relationship.from,
      to: relationship.to,
      ...(relationship.label ? { label: relationship.label } : {}),
    });
    nextLedger.relationships = withoutExisting;
  }

  return { ok: true, value: nextLedger };
}

async function readFileWithNode(path: string): Promise<string> {
  const { promises } = await import('node:fs');
  return promises.readFile(path, 'utf8');
}

async function writeFileWithNode(path: string, content: string): Promise<void> {
  const { promises } = await import('node:fs');
  await promises.writeFile(path, content, 'utf8');
}

function setLedgerCardStatus(ledger: unknown, operation: { cardId?: string; status?: 'todo' | 'done' } | undefined): Result<unknown> {
  if (!operation?.cardId) return { ok: false, error: 'Card status command requires --card-id.' };
  if (operation.status !== 'todo' && operation.status !== 'done') return { ok: false, error: 'Card status command requires todo or done.' };
  if (!isRecord(ledger)) return { ok: false, error: 'Card status command requires an object ledger.' };

  const cards = Array.isArray(ledger.cards) ? ledger.cards.map((card) => (isRecord(card) ? { ...card } : card)) : [];
  const card = cards.find((entry) => isRecord(entry) && entry.id === operation.cardId);
  if (!isRecord(card)) return { ok: false, error: `Card not found: ${operation.cardId}` };

  card.status = operation.status;
  return { ok: true, value: { ...ledger, cards } };
}

export async function manageLedgerJsonController(
  actionPayload: {
    ledgerCommand: 'answer' | 'card-context' | 'done' | 'execution-profile' | 'export' | 'inspect' | 'master-task-gate' | 'mutate' | 'overview' | 'session-context' | 'todo' | 'unanswered' | 'validate-master-tasks' | 'zone-cards';
    answerOperation?: { message?: string; messageFile?: string; messageStdin?: boolean; threadId?: string };
    cardOperation?: { cardId?: string };
    exportOperation?: { outputFile?: string };
    json?: boolean;
    ledgerJsonFile: string;
    mutation?: unknown;
    mutationFile?: string;
    mutationOperation?: {
      addCardFile?: string;
      addRelationships?: Array<{
        from?: string;
        id?: string;
        label?: string;
        to?: string;
      }>;
      cardH?: number;
      cardComment?: string;
      cardCommentFile?: string;
      cardQuestionnairesFile?: string;
      cardId?: string;
      cardLabels?: string[];
      cardTitle?: string;
      cardW?: number;
      cardX?: number;
      cardY?: number;
      removeCardIds?: string[];
      removeRelationshipIds?: string[];
    };
    statusOperation?: { cardId?: string; status: 'todo' | 'done' };
    zoneOperation?: { zoneId?: string };
  },
  fs?: FileSystemPort,
): Promise<Result<unknown>> {
  telemetry('read-ledger-json', { path: actionPayload.ledgerJsonFile });
  const ledger = await readLedgerJson(actionPayload.ledgerJsonFile, fs);

  // WHY: invalid JSON cannot be used as committed ledger truth.
  // WHAT: stop before any mutation write.
  if (!ledger.ok) {
    telemetry('manage-ledger-json-rejected', { error: ledger.error });
    return ledger;
  }

  if (isWorkerOwnedTaskLedger(actionPayload.ledgerJsonFile, fs) && actionPayload.ledgerCommand === 'answer') {
    // WHAT: Route the one note through the current task worker.
    // WHY: Task Markdown must remain untouched until the scoped causal mutation commits.
    return appendTaskThreadAnswer(actionPayload.answerOperation, fs);
  }
  if (isWorkerOwnedTaskLedger(actionPayload.ledgerJsonFile, fs) && actionPayload.ledgerCommand === 'mutate') {
    // WHAT: Reject an undeclared aggregate task mutation before helper-side file effects.
    // WHY: Only typed task commands may select current-state lanes.
    return { ok: false, error: 'scoped_task_command_required:mutate' };
  }

  if (actionPayload.ledgerCommand === 'session-context') {
    return resolveSessionContext({ ledger: ledger.value, ledgerJsonFile: actionPayload.ledgerJsonFile, cardId: actionPayload.cardOperation?.cardId, fs });
  }

  if (actionPayload.ledgerCommand === 'master-task-gate') {
    return resolveMasterTaskGate({ ledger: ledger.value, ledgerJsonFile: actionPayload.ledgerJsonFile, cardId: actionPayload.cardOperation?.cardId, fs });
  }

  if (actionPayload.ledgerCommand === 'execution-profile') {
    const workspaceRoot = process.env.DECISION_OS_LEDGER_ROOT
      ? resolve(process.env.DECISION_OS_LEDGER_ROOT, '..')
      : resolve(actionPayload.ledgerJsonFile, '../..');
    const packageFile = resolve(workspaceRoot, 'package.json');
    let packageJson: JsonObject = {};
    try { packageJson = JSON.parse(await readFileWithNode(packageFile)) as JsonObject; } catch { /* typed unavailable fields below */ }
    const scripts = isRecord(packageJson.scripts) ? packageJson.scripts : {};
    const primaryRoot = primaryCheckoutRoot(workspaceRoot);
    const dependencyRoots = [primaryRoot, resolve(primaryRoot, 'backend'), resolve(primaryRoot, 'frontend'), resolve(primaryRoot, 'ledger-cli'), workspaceRoot, resolve(workspaceRoot, 'backend'), resolve(workspaceRoot, 'frontend'), resolve(workspaceRoot, 'ledger-cli')]
      .map((root) => resolve(root, 'node_modules')).filter((value, index, all) => existsSync(value) && all.indexOf(value) === index);
    const backendTsx = resolve(workspaceRoot, 'backend', 'node_modules', 'tsx', 'dist', 'esm', 'index.mjs');
    const backendTsc = resolve(workspaceRoot, 'backend', 'node_modules', '.bin', 'tsc');
    const frontendTsc = resolve(workspaceRoot, 'frontend', 'node_modules', '.bin', 'tsc');
    const ledgerTsc = resolve(workspaceRoot, 'ledger-cli', 'node_modules', '.bin', 'tsc');
    const verificationLease = `node ${shellQuote(resolve(workspaceRoot, 'bin', 'decision-os-verify.mjs'))} --`;
    const leased = (command: string): string => command ? `${verificationLease} ${command}` : '';
    const packageRoots = ['backend', 'frontend', 'ledger-cli'].map((name) => resolve(workspaceRoot, name)).filter((root) => existsSync(resolve(root, 'package-lock.json')));
    const bootstrap = packageRoots.filter((root) => !existsSync(resolve(root, 'node_modules'))).map((root) => `npm ci --ignore-scripts --prefix ${shellQuote(root)}`);
    const typechecks = [
      existsSync(backendTsc) ? leased(`${shellQuote(backendTsc)} -p ${shellQuote(resolve(workspaceRoot, 'backend', 'tsconfig.json'))} --noEmit`) : '',
      existsSync(frontendTsc) ? leased(`${shellQuote(frontendTsc)} -p ${shellQuote(resolve(workspaceRoot, 'frontend', 'tsconfig.json'))} --noEmit`) : '',
      existsSync(ledgerTsc) ? leased(`${shellQuote(ledgerTsc)} -p ${shellQuote(resolve(workspaceRoot, 'ledger-cli', 'tsconfig.json'))} --noEmit`) : '',
    ].filter(Boolean);
    const focusedTests = [
      existsSync(backendTsx) ? leased(`env TSX_TSCONFIG_PATH=${shellQuote(resolve(workspaceRoot, 'backend', 'tsconfig.json'))} node --test --import ${shellQuote(backendTsx)} <backend-test-file>`) : '',
      existsSync(backendTsx) ? leased(`env TSX_TSCONFIG_PATH=${shellQuote(resolve(workspaceRoot, 'ledger-cli', 'tsconfig.json'))} node --test --import ${shellQuote(backendTsx)} <ledger-cli-test-file>`) : '',
    ].filter(Boolean);
    const executable = (file: string): boolean => { try { accessSync(file, constants.X_OK); return true; } catch { return false; } };
    const serverLauncher = resolve(workspaceRoot, 'bin', 'decision-os-server.mjs');
    const browserDriver = resolve(workspaceRoot, 'frontend', 'node_modules', '.bin', 'playwright');
    const output = {
      version: 1,
      projectId: process.env.DECISION_OS_PROJECT_ID ?? '',
      workspaceRoot,
      decisionOsRoot: process.env.DECISION_OS_LEDGER_ROOT ?? resolve(workspaceRoot, '.decision-os'),
      ledgerFile: resolve(actionPayload.ledgerJsonFile),
      packageManager: 'npm',
      scripts,
      commands: {
        verificationLease: 'node bin/decision-os-verify.mjs -- <command> [args...]',
        install: 'npm install',
        typechecks,
        focusedTests,
        worktreeBootstrap: bootstrap,
      },
      primaryRoot,
      dependencyRoots,
      server: { launcher: serverLauncher, available: executable(serverLauncher), url: process.env.DECISION_OS_SERVER_URL ?? '', frontendRoot: existsSync(resolve(workspaceRoot, 'frontend')) ? resolve(workspaceRoot, 'frontend') : null },
      browser: { driver: browserDriver, available: executable(browserDriver) },
      serverUrl: process.env.DECISION_OS_SERVER_URL ?? '',
      restartPolicy: 'Do not restart or stop the server unless the operator explicitly asks.',
      ready: existsSync(packageFile) && bootstrap.length === 0,
    };
    return { ok: true, value: JSON.stringify(output, null, 2) };
  }
  if (actionPayload.ledgerCommand === 'validate-master-tasks') {
    const hydratedLedger = await hydrateLedgerCardContent(ledger.value, actionPayload.ledgerJsonFile, fs);
    const report = validateMasterTasks(hydratedLedger, actionPayload.cardOperation?.cardId);
    const output = formatMasterTaskValidation(report);
    return report.errors.length === 0 ? { ok: true, value: output } : { ok: false, error: output };
  }

  if (actionPayload.ledgerCommand === 'card-context') {
    const context = resolveLedgerCardContext({ ledger: ledger.value, ledgerJsonFile: actionPayload.ledgerJsonFile, cardId: actionPayload.cardOperation?.cardId });
    if (!context.ok) {
      telemetry('manage-ledger-json-rejected', { error: context.error });
      return context;
    }
    telemetry('manage-ledger-json-completed');
    return { ok: true, value: JSON.stringify(context.value, null, 2) };
  }

  if (actionPayload.ledgerCommand === 'zone-cards') {
    const context = resolveLedgerZoneCardsContext({ ledger: ledger.value, ledgerJsonFile: actionPayload.ledgerJsonFile, zoneId: actionPayload.zoneOperation?.zoneId });
    if (!context.ok) {
      telemetry('manage-ledger-json-rejected', { error: context.error });
      return context;
    }
    telemetry('manage-ledger-json-completed');
    return { ok: true, value: JSON.stringify(context.value, null, 2) };
  }

  if (actionPayload.ledgerCommand === 'overview') {
    telemetry('manage-ledger-json-completed');
    return { ok: true, value: formatLedgerOverview(ledger.value) };
  }

  if (actionPayload.ledgerCommand === 'export') {
    const outputFile = actionPayload.exportOperation?.outputFile;
    if (!outputFile) {
      const error = 'Ledger export requires --output <file.md>.';
      telemetry('manage-ledger-json-rejected', { error });
      return { ok: false, error };
    }
    if (!outputFile.endsWith('.md')) {
      const error = 'Ledger export output must be a .md file.';
      telemetry('manage-ledger-json-rejected', { error });
      return { ok: false, error };
    }

    const hydratedLedger = await hydrateLedgerCardContent(ledger.value, actionPayload.ledgerJsonFile, fs);
    const markdown = formatLedgerMarkdownExport(hydratedLedger);
    await (fs ? fs.writeFile(outputFile, markdown) : writeFileWithNode(outputFile, markdown));
    telemetry('write-ledger-markdown-export', { path: outputFile });
    telemetry('manage-ledger-json-completed');
    return { ok: true, value: `Exported markdown to ${outputFile}` };
  }

  if (actionPayload.ledgerCommand === 'unanswered') {
    telemetry('manage-ledger-json-completed');
    const threads = findUnansweredThreads(ledger.value, actionPayload.ledgerJsonFile);
    return { ok: true, value: formatUnansweredThreads(threads, Boolean(actionPayload.json)) };
  }

  if (actionPayload.ledgerCommand === 'answer') {
    await hydrateLedgerThreadNotesFor(ledger.value, actionPayload.ledgerJsonFile, actionPayload.answerOperation?.threadId ?? '', fs);
    const answered = await appendThreadAnswer(ledger.value, actionPayload.answerOperation, actionPayload.ledgerJsonFile, fs);
    if (!answered.ok) {
      telemetry('manage-ledger-json-rejected', { error: answered.error });
      return answered;
    }
    const answeredLedger = answered.value;
    const notes = isRecord(answeredLedger) && isRecord(answeredLedger.notes) ? answeredLedger.notes : {};
    const threadNotes = Array.isArray(notes[actionPayload.answerOperation?.threadId ?? '']) ? notes[actionPayload.answerOperation?.threadId ?? ''] as unknown[] : [];
    const note = threadNotes.at(-1);
    await writeLedgerJson(actionPayload.ledgerJsonFile, stripHydratedThreadNotes(answeredLedger), fs);
    telemetry('write-ledger-json', { path: actionPayload.ledgerJsonFile });
    telemetry('manage-ledger-json-completed');
    return { ok: true, value: JSON.stringify({ version: 1, persisted: true, note }, null, 2) };
  }

  if (actionPayload.ledgerCommand === 'todo' || actionPayload.ledgerCommand === 'done') {
    const statusResult = setLedgerCardStatus(ledger.value, actionPayload.statusOperation);
    if (!statusResult.ok) {
      telemetry('manage-ledger-json-rejected', { error: statusResult.error });
      return statusResult;
    }
    const statusOperation = actionPayload.statusOperation!;
    const remotelyCommitted = await transitionCardLifecycle(actionPayload.ledgerJsonFile, statusOperation.cardId!, statusOperation.status, fs);
    if (!remotelyCommitted) await writeLedgerJson(actionPayload.ledgerJsonFile, stripHydratedThreadNotes(statusResult.value), fs);
    telemetry('write-ledger-json', { path: actionPayload.ledgerJsonFile });
    telemetry('manage-ledger-json-completed');
    return statusResult;
  }

  // WHY: mutate mode is the only ledger command allowed to write.
  // WHAT: persist either the provided mutation object, mutation file, targeted operation, or current validated ledger.
  if (actionPayload.ledgerCommand === 'mutate') {
    const mutationFromFile = actionPayload.mutationFile ? await readLedgerJson(actionPayload.mutationFile, fs) : undefined;
    if (mutationFromFile && !mutationFromFile.ok) {
      telemetry('manage-ledger-json-rejected', { error: mutationFromFile.error });
      return mutationFromFile;
    }

    const baseMutation = actionPayload.mutation ?? mutationFromFile?.value ?? ledger.value;
    const operatedMutation = await applyLedgerMutationOperation(baseMutation, actionPayload.mutationOperation, actionPayload.ledgerJsonFile, fs);
    if (!operatedMutation.ok) {
      telemetry('manage-ledger-json-rejected', { error: operatedMutation.error });
      return operatedMutation;
    }

    await writeLedgerJson(actionPayload.ledgerJsonFile, stripHydratedThreadNotes(operatedMutation.value), fs);
    telemetry('write-ledger-json', { path: actionPayload.ledgerJsonFile });
  }

  telemetry('manage-ledger-json-completed');
  return ledger;
}
