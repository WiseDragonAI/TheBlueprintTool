/**
 * WHAT: Maintains one deterministic admin master task from the central runtime incident ledger.
 * WHY: Runtime failures need a durable, operator-visible review queue without duplicating task cards.
 */
import { resolve } from 'node:path';
import { applyLedgerMutation, type LedgerMutation } from '../../ledger/helper/apply-ledger-mutation.js';
import { readCardDescription } from '../../ledger/helper/card-content-file.js';
import type { ProjectTaskState } from '../../task-state/helper/project-task-state.js';
import { tasksLedgerForProject, type DecisionOsProject } from './project-catalog.js';
import type { RuntimeIncident } from './runtime-incident-ledger.js';

type AnyRecord = Record<string, unknown>;

export const runtimeIncidentReviewCardId = 'card-runtime-incident-review';
export const runtimeIncidentReviewZoneId = 'zone-runtime-incident-review';

const reviewLabels = ['master-task', 'operations', 'recurring', 'runtime-incidents'];

function firstStackFrame(stack: string): string {
  return stack.split('\n').map((line) => line.trim()).find((line) => line.startsWith('at ')) ?? 'No stack frame recorded.';
}

function incidentLine(incident: RuntimeIncident): string {
  return [
    `**\`${incident.id}\`** — \`${incident.status}\` / \`${incident.severity}\` / \`${incident.code}\`.`,
    `Scope \`${incident.scope}\`; component \`${incident.component}\`; operation \`${incident.operation}\`.`,
    `First \`${incident.firstObservedAt}\`; last \`${incident.lastObservedAt}\`; occurrences \`${incident.occurrences}\`.`,
    `Message: ${incident.message}`,
    `First stack frame: \`${firstStackFrame(incident.stack)}\``,
  ].join(' ');
}

export function runtimeIncidentReviewBody(input: {
  updatedAt: string;
  incidents: RuntimeIncident[];
  incidentLedgerFile: string;
}): string {
  const active = input.incidents
    .filter((incident) => incident.status === 'paused')
    .sort((left, right) => right.lastObservedAt.localeCompare(left.lastObservedAt));
  const resolved = input.incidents
    .filter((incident) => incident.status === 'resolved')
    .sort((left, right) => right.lastObservedAt.localeCompare(left.lastObservedAt));
  const retainedResolved = resolved.slice(0, 20);
  const numbered = (incidents: RuntimeIncident[], empty: string): string[] => incidents.length > 0
    ? incidents.map((incident, index) => `${index + 1}. ${incidentLine(incident)}`)
    : [`1. ${empty}`];

  return [
    '## A. Runtime Incident Review',
    '',
    '1. **Action:** Analyze every listed incident, traverse its full stack to the first incorrect application transition, correct the root cause, add a regression, and run repository verification.',
    `2. **Central log:** \`${input.incidentLedgerFile}\`.`,
    '3. **Diagnostics endpoint:** `GET /api/diagnostics/incidents`.',
    `4. **Snapshot updated:** \`${input.updatedAt || 'not-recorded'}\`.`,
    `5. **Counts:** \`${active.length}\` active; \`${resolved.length}\` resolved; \`${input.incidents.length}\` retained.`,
    '6. **Stack evidence:** The central log is authoritative and retains the complete bounded stack for every incident.',
    '',
    '---',
    '',
    '## B. Active Incidents',
    '',
    ...numbered(active, 'No active incidents.'),
    '',
    '---',
    '',
    '## C. Recent Resolved Incidents',
    '',
    ...numbered(retainedResolved, 'No resolved incidents.'),
    '',
    '---',
    '',
    '## D. Closeout Gate',
    '',
    '1. Keep this recurring master task open. Record analysis and implementation evidence in its thread after each review run.',
    '2. Do not clear an active incident until the failed scope has recovered and the diagnostics endpoint reports the incident as resolved.',
  ].join('\n');
}

function applyMutation(input: {
  project: DecisionOsProject;
  ledgerPath: string;
  ledger: AnyRecord;
  mutation: LedgerMutation;
}): void {
  const result = applyLedgerMutation({
    decisionOsRoot: input.project.decisionOsRoot,
    ledgerPath: input.ledgerPath,
    ledger: input.ledger,
    mutation: input.mutation,
  });
  if (!result.ok) throw new Error(String(result.error?.body.error ?? 'Could not synchronize the runtime incident review task.'));
}

export async function synchronizeRuntimeIncidentReviewTask(input: {
  project: DecisionOsProject;
  taskState: ProjectTaskState;
  updatedAt: string;
  incidents: RuntimeIncident[];
  incidentLedgerFile: string;
}): Promise<{ changed: boolean; cardId: string; zoneId: string }> {
  // WHAT: Avoid materializing an operational task without incident evidence.
  // WHY: The task exists to expose retained failures, not to create an empty process artifact.
  if (input.incidents.length === 0) return { changed: false, cardId: runtimeIncidentReviewCardId, zoneId: runtimeIncidentReviewZoneId };
  const ledger = tasksLedgerForProject(input.project);
  const ledgerPath = resolve(input.project.decisionOsRoot, ledger.ledgerFile.replace(/^\.decision-os\//, ''));
  const before = structuredClone(input.taskState.projection().ledger) as AnyRecord & { cards?: AnyRecord[]; annotations?: AnyRecord[] };
  const after = structuredClone(before) as typeof before;
  const existingCard = (before.cards ?? []).find((card) => String(card.id ?? '') === runtimeIncidentReviewCardId);
  const body = runtimeIncidentReviewBody(input);
  let mutation: LedgerMutation;

  // WHAT: Admit the task and its zone atomically on the first incident snapshot.
  // WHY: Stable identifiers make retries idempotent across server restarts.
  if (!existingCard) {
    const rightEdge = (before.annotations ?? []).reduce(
      (maximum, annotation) => Math.max(maximum, Number(annotation.x ?? 0) + Number(annotation.width ?? 0)),
      0,
    );
    const x = rightEdge + 80;
    mutation = {
      action: 'create-master-task',
      annotation: {
        id: runtimeIncidentReviewZoneId,
        variant: 'zone',
        label: 'Operations · Runtime Incidents',
        color: '#d94f70',
        x,
        y: 80,
        width: 1120,
        height: 720,
      },
      card: {
        id: runtimeIncidentReviewCardId,
        title: 'Analyze Decision OS runtime incidents',
        status: 'todo',
        createdAt: input.updatedAt || new Date().toISOString(),
        cardType: 'note',
        labels: reviewLabels,
        x: x + 60,
        y: 140,
        w: 420,
        h: 420,
        comment: { what: body },
      },
      cards: [],
      relationships: [],
    };
  } else {
    const currentBody = readCardDescription({ decisionOsRoot: input.project.decisionOsRoot, card: existingCard });
    // WHAT: Leave an already-current task and content resource untouched.
    // WHY: An unchanged periodic pass must produce no task-state mutation.
    if (currentBody === body) return { changed: false, cardId: runtimeIncidentReviewCardId, zoneId: runtimeIncidentReviewZoneId };
    mutation = {
      action: 'patch-card',
      cardPatch: { id: runtimeIncidentReviewCardId, description: body },
    };
  }

  applyMutation({ project: input.project, ledgerPath, ledger: after, mutation });
  const committed = await input.taskState.executeMutation(mutation, before, after);
  const card = (committed.ledger.cards as AnyRecord[] | undefined)?.find((entry) => String(entry.id ?? '') === runtimeIncidentReviewCardId);
  const comment = card?.comment && typeof card.comment === 'object' ? card.comment as AnyRecord : {};
  await input.taskState.recordContentContribution(runtimeIncidentReviewCardId, String(comment.contentFile ?? ''));
  return { changed: true, cardId: runtimeIncidentReviewCardId, zoneId: runtimeIncidentReviewZoneId };
}
