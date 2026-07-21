import { randomUUID } from 'node:crypto';
import type { Result } from '../../../lib/types.js';

type AnyRecord = Record<string, unknown>;
type CreatedFile = { kind?: unknown; cardId?: unknown; path?: unknown };

function id(prefix: 'card' | 'rel' | 'zone'): string {
  return `${prefix}-${randomUUID()}`;
}

function nextZone(ledger: AnyRecord): { x: number; y: number; width: number; height: number } {
  const annotations = Array.isArray(ledger.annotations) ? ledger.annotations.filter((entry): entry is AnyRecord => Boolean(entry && typeof entry === 'object')) : [];
  const zones = annotations.filter((zone) => zone.variant !== 'group' && typeof zone.color === 'string');
  if (zones.length === 0) return { x: 0, y: 0, width: 1200, height: 900 };
  const left = Math.min(...zones.map((zone) => Number(zone.x ?? 0)).filter(Number.isFinite));
  const bottom = Math.max(...zones.map((zone) => Number(zone.y ?? 0) + Number(zone.height ?? zone.h ?? 0)).filter(Number.isFinite));
  return { x: Number.isFinite(left) ? left : 0, y: Number.isFinite(bottom) ? bottom + 120 : 0, width: 1200, height: 900 };
}

function cardFile(cardId: string): string {
  return `.decision-os/cards/tasks/${cardId}.md`;
}

export async function createMasterTask(input: { projectId?: string; title?: string; subtasks: string[] }): Promise<Result<string>> {
  const serverUrl = String(process.env.DECISION_OS_SERVER_URL ?? '').trim().replace(/\/$/, '');
  const projectId = String(input.projectId ?? '').trim();
  const title = String(input.title ?? '').trim();
  const subtasks = input.subtasks.map((value) => value.trim()).filter(Boolean);
  if (!serverUrl) return { ok: false, error: 'master-task-create requires DECISION_OS_SERVER_URL.' };
  if (!projectId || !title) return { ok: false, error: 'master-task-create requires --project and --title.' };
  try {
    const [catalogResponse, projectionResponse] = await Promise.all([
      fetch(`${serverUrl}/api/control-room?localOnly=1`),
      fetch(`${serverUrl}/api/task-state/projection?projectId=${encodeURIComponent(projectId)}`),
    ]);
    if (!catalogResponse.ok) return { ok: false, error: `Project query failed (${catalogResponse.status}): ${await catalogResponse.text()}` };
    if (!projectionResponse.ok) return { ok: false, error: `Task projection failed (${projectionResponse.status}): ${await projectionResponse.text()}` };
    const catalog = await catalogResponse.json() as { projects?: Array<{ id?: unknown; color?: unknown }> };
    const project = (catalog.projects ?? []).find((entry) => String(entry.id ?? '') === projectId);
    if (!project) return { ok: false, error: `Project not found: ${projectId}` };
    const projection = await projectionResponse.json() as { ledger?: AnyRecord };
    if (!projection.ledger) return { ok: false, error: 'Task projection has no ledger.' };

    const zone = { id: id('zone'), ...nextZone(projection.ledger), color: String(project.color ?? '#38d9e8'), label: title, comments: [] };
    const masterId = id('card');
    const timestamp = new Date().toISOString();
    const createdSubtasks = subtasks.map((subtaskTitle, index) => {
      const cardId = id('card');
      const column = index % 2;
      const row = Math.floor(index / 2);
      return {
        card: { id: cardId, title: subtaskTitle, cardType: 'note', domainId: 'tasks', status: 'todo', createdAt: timestamp, labels: [], x: zone.x + 450 + column * 350, y: zone.y + 60 + row * 220, w: 310, h: 180, comment: { what: '', contentFile: cardFile(cardId) }, facts: [], fields: [] },
        relationship: { id: id('rel'), from: masterId, to: cardId, label: 'subtask', position: index },
      };
    });
    const master = {
      id: masterId,
      title,
      cardType: 'note',
      domainId: 'tasks',
      status: 'todo',
      createdAt: timestamp,
      labels: ['master-task'],
      x: zone.x + 60,
      y: zone.y + 60,
      w: 360,
      h: 240,
      comment: { what: '', contentFile: cardFile(masterId) },
      facts: [],
      fields: [],
    };
    const response = await fetch(`${serverUrl}/p/${encodeURIComponent(projectId)}/decision-os/tasks`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'create-master-task', annotation: zone, card: master, cards: createdSubtasks.map((entry) => entry.card), relationships: createdSubtasks.map((entry) => entry.relationship) }),
    });
    if (!response.ok) return { ok: false, error: `Master-task creation failed (${response.status}): ${await response.text()}` };
    const payload = await response.json() as { createdFiles?: CreatedFile[] };
    const files = (payload.createdFiles ?? []).map((entry) => ({ kind: String(entry.kind ?? ''), cardId: String(entry.cardId ?? ''), path: String(entry.path ?? '') }));
    if (files.length !== subtasks.length + 1 || files.some((entry) => !entry.kind || !entry.cardId || !entry.path)) return { ok: false, error: 'Master-task creation returned incomplete file paths.' };
    return { ok: true, value: files.map((entry) => `${entry.kind}\t${entry.cardId}\t${entry.path}`).join('\n') };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Master-task creation failed.' };
  }
}
