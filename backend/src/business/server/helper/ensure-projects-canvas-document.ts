/**
 * WHAT: Mirrors registered projects into the master projects canvas while preserving operator geometry.
 * WHY: Project membership and project layout need separate authoritative persistence boundaries.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { replaceTextFileAtomically } from '../../ledger/helper/card-content-file.js';
import type { DecisionOsProject } from './project-catalog.js';

type AnyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AnyRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function defaultProjectCard(project: DecisionOsProject, index: number): AnyRecord {
  return {
    id: `project-card:${project.id}`,
    targetProjectId: project.id,
    cardType: 'project',
    domainId: 'projects',
    title: project.name,
    x: (index % 4) * 460,
    y: Math.floor(index / 4) * 280,
    w: 360,
    h: 180,
    status: 'todo',
  };
}

export function ensureProjectsCanvasDocument(input: { masterDecisionOsRoot: string; projects: DecisionOsProject[] }): {
  path: string;
  document: AnyRecord & { cards: AnyRecord[]; annotations: AnyRecord[]; relationships: AnyRecord[] };
} {
  const path = resolve(input.masterDecisionOsRoot, 'projects-canvas.json');
  const existing = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) as unknown : {};
  if (!isRecord(existing)) throw new Error('invalid_projects_canvas_root');
  const document = existing;
  for (const field of ['cards', 'annotations', 'relationships'] as const) {
    if (Object.hasOwn(document, field) && (!Array.isArray(document[field]) || (document[field] as unknown[]).some((entry) => !isRecord(entry)))) {
      throw new Error(`invalid_projects_canvas_${field}`);
    }
  }
  for (const field of ['diagramSize', 'viewport', 'notes'] as const) {
    if (Object.hasOwn(document, field) && !isRecord(document[field])) throw new Error(`invalid_projects_canvas_${field}`);
  }
  const cards = Array.isArray(document.cards) ? document.cards as AnyRecord[] : [];
  const registeredIds = new Set(input.projects.map((project) => project.id));
  const nextCards = cards.filter((card) => {
    const targetProjectId = String(card.targetProjectId ?? '');
    return !targetProjectId || registeredIds.has(targetProjectId);
  });

  for (const [index, project] of input.projects.entries()) {
    const cardId = `project-card:${project.id}`;
    let card = nextCards.find((candidate) => String(candidate.id ?? '') === cardId)
      ?? nextCards.find((candidate) => String(candidate.targetProjectId ?? '') === project.id);
    // WHAT: Add a deterministic layout only for newly registered projects.
    // WHY: Existing operator-authored geometry must survive metadata and catalog updates.
    if (!card) {
      card = defaultProjectCard(project, index);
      nextCards.push(card);
    }
    card.id = cardId;
    card.targetProjectId = project.id;
    card.cardType = 'project';
    card.domainId = 'projects';
    card.title = project.name;
    card.color = project.color;
    card.description = project.description;
    card.w = Math.max(220, Number(card.w ?? 360));
    card.h = Math.max(132, Number(card.h ?? 180));
  }

  document.modelName = 'projects-canvas';
  document.diagramSize = isRecord(document.diagramSize) ? document.diagramSize : { width: 5200, height: 2600 };
  document.viewport = isRecord(document.viewport) ? document.viewport : { x: 0, y: 0, scale: 0.42 };
  document.cards = nextCards;
  document.annotations = Array.isArray(document.annotations) ? document.annotations : [];
  document.relationships = Array.isArray(document.relationships) ? document.relationships : [];
  document.notes = isRecord(document.notes) ? document.notes : {};
  replaceTextFileAtomically(path, JSON.stringify(document, null, 2));
  return {
    path,
    document: document as AnyRecord & { cards: AnyRecord[]; annotations: AnyRecord[]; relationships: AnyRecord[] },
  };
}
