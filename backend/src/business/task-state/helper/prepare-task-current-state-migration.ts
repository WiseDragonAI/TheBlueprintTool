/**
 * WHAT: Normalizes one legacy task projection into the audited epoch-4 lifecycle, assignment, and task-graph domain.
 * WHY: Content-derived lifecycle and child-label membership may be interpreted exactly once during offline cutover.
 */
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

type AnyRecord = Record<string, unknown>;
type BodyRewrite = { cardId: string; file: string; contentFile: string; before: string; after: string; removedGeneratedContent: boolean };
type LifecycleAudit = { cardId: string; createdAt: string; createdAtSource: string; status: string; statusSource: string; waitingAt: string | null; waitingAtSource: string; closedAt: string | null; closedAtSource: string };
type RelationshipRepair = { relationshipId: string; from: string; to: string; previousPosition: number | null; position: number };
type RecoveredNoteDeletion = { threadId: string; noteId: string };
type AssignmentAudit = { cardId: string; inherited: boolean; assignedNodeId: string | null };

const epoch = new Date(0).toISOString();
const legacyExecutionCardFields = new Set([
  'executionIntent',
  'codexActiveRunId',
  'codexActiveExecutionId',
  'codexQueuedPipelineRunId',
  'codexQueuedRunId',
  'codexRunId',
  'codexRunOutputFile',
  'codexThreadRunId',
  'codexThreadRunIds',
  'codexThreadRunOutputFile',
  'codexThreadRunOutputFiles',
  'codexPipelineRunId',
  'codexPipelineName',
  'codexPipelineStepId',
  'codexPipelineStepName',
  'codexSkillName',
  'codexRunModel',
  'codexRunEffort',
  'codexStatus',
  'codexProcessing',
  'codexQueued',
  'codexQueuePosition',
  'transcribingBeforeLaunch',
]);

export function isLegacyExecutionCardField(path: string): boolean {
  const root = path.split('/')[0] ?? '';
  return legacyExecutionCardFields.has(root);
}

function records(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? value.filter((entry): entry is AnyRecord => Boolean(entry && typeof entry === 'object')) : [];
}

function contentFile(decisionOsRoot: string, card: AnyRecord): { ref: string; file: string } | null {
  const comment = card.comment && typeof card.comment === 'object' && !Array.isArray(card.comment) ? card.comment as AnyRecord : {};
  const ref = String(comment.contentFile ?? '');
  if (!ref.endsWith('.md')) return null;
  const file = resolve(decisionOsRoot, ref.replace(/^\/?\.decision-os\//, ''));
  const inner = relative(decisionOsRoot, file);
  return inner && !inner.startsWith('..') && !isAbsolute(inner) ? { ref, file } : null;
}

function bodyValue(markdown: string, label: string): string {
  return markdown.match(new RegExp(`^${label}:\\s*(.+?)\\s*$`, 'im'))?.[1] ?? '';
}

function validTimestamp(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  return text && Number.isFinite(Date.parse(text)) ? new Date(text).toISOString() : '';
}

function rewriteNarrative(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const containsGeneratedState = lines.some((line) => (
    /^##\s+(?:[A-Z]\.\s*)?Subtasks\s*$/i.test(line.trim())
    || /^(Waiting since|Completed at|Active since|Task status):/i.test(line.trim())
    || /(^|\s)#task-(?:active|complete|waiting|backlog|execution)\b/i.test(line)
  ));
  if (!containsGeneratedState) return markdown;
  const output: string[] = [];
  let generatedSubtasks = false;
  for (const line of lines) {
    const heading = /^##\s+(?:[A-Z]\.\s*)?Subtasks\s*$/i.test(line.trim());
    // WHAT: Remove the complete generated subtask section until the next peer heading.
    // WHY: Relationship entities are the sole child-membership authority after cutover.
    if (heading) { generatedSubtasks = true; continue; }
    if (generatedSubtasks && /^##\s+/.test(line)) generatedSubtasks = false;
    if (generatedSubtasks) continue;
    // WHAT: Remove legacy lifecycle metadata lines and generated task-state tags.
    // WHY: Narrative Markdown must not retain a second writable status representation.
    if (/^(Waiting since|Completed at|Active since|Task status):/i.test(line.trim())) continue;
    output.push(line.replace(/(^|\s)#task-(?:active|complete|waiting|backlog|execution)\b/gi, '$1').replace(/[ \t]+$/g, ''));
  }
  return `${output.join('\n').replace(/^\n+|\n+$/g, '').replace(/\n{3,}/g, '\n\n')}\n`;
}

function legacyStatus(card: AnyRecord, markdown: string): { value: 'todo' | 'backlog' | 'done'; source: string } {
  const lifecycle = card.lifecycle && typeof card.lifecycle === 'object' && !Array.isArray(card.lifecycle) ? card.lifecycle as AnyRecord : {};
  const structural = String(lifecycle.status ?? card.status ?? '');
  if (structural === 'todo' || structural === 'backlog' || structural === 'done') return { value: structural, source: lifecycle.status ? 'card.lifecycle.status' : 'card.status' };
  if (/#task-complete\b/i.test(markdown) || bodyValue(markdown, 'Completed at')) return { value: 'done', source: 'card-markdown' };
  if (/#task-(?:active|waiting|execution)\b/i.test(markdown) || bodyValue(markdown, 'Waiting since')) return { value: 'todo', source: 'card-markdown' };
  return { value: 'backlog', source: 'migration-default' };
}

export function prepareTaskCurrentStateMigration(input: { decisionOsRoot: string; ledger: AnyRecord; defaultAssignedNodeId: string; readContent?: (ref: string) => string | null; deferRelationshipValidation?: boolean }): {
  ledger: AnyRecord;
  bodyRewrites: BodyRewrite[];
  lifecycleAudit: LifecycleAudit[];
  assignmentAudit: AssignmentAudit[];
  relationshipRepairs: RelationshipRepair[];
  recoveredNoteDeletions: RecoveredNoteDeletion[];
} {
  if (!/^[a-zA-Z0-9_-]+$/.test(input.defaultAssignedNodeId)) throw new Error('invalid_task_migration_default_assigned_node_id');
  const ledger = structuredClone(input.ledger);
  const cards = records(ledger.cards);
  const relationships = records(ledger.relationships);
  const inheritedCardIds = new Set(relationships
    .filter((relationship) => relationship.label === 'subtask')
    .map((relationship) => String(relationship.to ?? ''))
    .filter(Boolean));
  const bodyRewrites: BodyRewrite[] = [];
  const lifecycleAudit: LifecycleAudit[] = [];
  const assignmentAudit: AssignmentAudit[] = [];
  for (const card of cards) {
    const content = contentFile(input.decisionOsRoot, card);
    const supplied = content ? input.readContent?.(content.ref) : null;
    const markdown = typeof supplied === 'string' ? supplied : content && existsSync(content.file) ? readFileSync(content.file, 'utf8') : '';
    const currentLifecycle = card.lifecycle && typeof card.lifecycle === 'object' && !Array.isArray(card.lifecycle) ? card.lifecycle as AnyRecord : {};
    const status = legacyStatus(card, markdown);
    const legacyCreatedAt = validTimestamp(card.createdAt);
    const createdAt = legacyCreatedAt || epoch;
    const waitingAt = status.value === 'todo'
      ? validTimestamp(currentLifecycle.waitingAt) || validTimestamp(card.waitingAt) || validTimestamp(bodyValue(markdown, 'Waiting since')) || createdAt
      : '';
    const closedAt = status.value === 'done'
      ? validTimestamp(currentLifecycle.closedAt) || validTimestamp(card.closedAt) || validTimestamp(card.completedAt) || validTimestamp(bodyValue(markdown, 'Completed at')) || createdAt
      : '';
    card.createdAt = createdAt;
    card.lifecycle = { status: status.value, changedAt: closedAt || waitingAt || createdAt, waitingAt: waitingAt || null, closedAt: closedAt || null };
    card.status = status.value;
    if (Array.isArray(card.labels)) card.labels = card.labels.map(String).filter((label) => label !== 'subtask');
    for (const field of legacyExecutionCardFields) delete card[field];
    const cardId = String(card.id ?? '');
    const inherited = inheritedCardIds.has(cardId);
    if (inherited) delete card.assignment;
    else card.assignment = { nodeId: input.defaultAssignedNodeId, changedAt: epoch, revision: 1 };
    assignmentAudit.push({ cardId, inherited, assignedNodeId: inherited ? null : input.defaultAssignedNodeId });
    lifecycleAudit.push({
      cardId,
      createdAt,
      createdAtSource: legacyCreatedAt ? 'card.createdAt' : 'migration-epoch',
      status: status.value,
      statusSource: status.source,
      waitingAt: waitingAt || null,
      waitingAtSource: waitingAt ? (validTimestamp(currentLifecycle.waitingAt) ? 'card.lifecycle.waitingAt' : validTimestamp(card.waitingAt) ? 'card.waitingAt' : bodyValue(markdown, 'Waiting since') ? 'card-markdown' : 'createdAt') : '',
      closedAt: closedAt || null,
      closedAtSource: closedAt ? (validTimestamp(currentLifecycle.closedAt) ? 'card.lifecycle.closedAt' : validTimestamp(card.closedAt) ? 'card.closedAt' : validTimestamp(card.completedAt) ? 'card.completedAt' : bodyValue(markdown, 'Completed at') ? 'card-markdown' : 'createdAt') : '',
    });
    if (content) {
      const after = rewriteNarrative(markdown);
      bodyRewrites.push({ cardId: String(card.id ?? ''), file: content.file, contentFile: content.ref, before: markdown, after, removedGeneratedContent: after !== markdown });
    }
  }

  const cardIds = new Set(cards.map((card) => String(card.id ?? '')).filter(Boolean));
  const invalid = relationships.filter((relationship) => relationship.label === 'subtask' && (!cardIds.has(String(relationship.from ?? '')) || !cardIds.has(String(relationship.to ?? ''))));
  if (!input.deferRelationshipValidation && invalid.length > 0) throw new Error(`invalid_subtask_relationships:${invalid.map((relationship) => String(relationship.id ?? '')).sort().join(',')}`);
  const relationshipRepairs: RelationshipRepair[] = [];
  const byParent = new Map<string, AnyRecord[]>();
  for (const relationship of relationships.filter((entry) => entry.label === 'subtask')) byParent.set(String(relationship.from ?? ''), [...(byParent.get(String(relationship.from ?? '')) ?? []), relationship]);
  for (const [from, children] of byParent) {
    children.sort((left, right) => {
      const leftPosition = Number.isInteger(Number(left.position)) && Number(left.position) >= 0 ? Number(left.position) : Number.MAX_SAFE_INTEGER;
      const rightPosition = Number.isInteger(Number(right.position)) && Number(right.position) >= 0 ? Number(right.position) : Number.MAX_SAFE_INTEGER;
      return leftPosition - rightPosition || String(left.id ?? '').localeCompare(String(right.id ?? ''));
    });
    children.forEach((relationship, position) => {
      const previousPosition = Number.isInteger(Number(relationship.position)) && Number(relationship.position) >= 0 ? Number(relationship.position) : null;
      relationship.position = position;
      relationshipRepairs.push({ relationshipId: String(relationship.id ?? ''), from, to: String(relationship.to ?? ''), previousPosition, position });
    });
  }
  const recoveredNoteDeletions: RecoveredNoteDeletion[] = [];
  const notesByThread = ledger.notes && typeof ledger.notes === 'object' && !Array.isArray(ledger.notes) ? ledger.notes as Record<string, unknown> : {};
  const deletedByThread = ledger.deletedNoteIds && typeof ledger.deletedNoteIds === 'object' && !Array.isArray(ledger.deletedNoteIds) ? ledger.deletedNoteIds as Record<string, unknown> : {};
  for (const [threadId, rawNotes] of Object.entries(notesByThread)) {
    const live = new Set(records(rawNotes).map((note) => String(note.id ?? '')).filter(Boolean));
    const deleted = Array.isArray(deletedByThread[threadId]) ? (deletedByThread[threadId] as unknown[]).map(String).filter(Boolean) : [];
    const retained = deleted.filter((noteId) => !live.has(noteId));
    for (const noteId of deleted.filter((candidate) => live.has(candidate))) recoveredNoteDeletions.push({ threadId, noteId });
    deletedByThread[threadId] = retained;
  }
  ledger.deletedNoteIds = deletedByThread;
  return { ledger, bodyRewrites, lifecycleAudit, assignmentAudit, relationshipRepairs, recoveredNoteDeletions };
}
