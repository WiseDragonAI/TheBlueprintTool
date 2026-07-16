/**
 * WHAT: Proves registry mirroring and geometry preservation for the master projects canvas.
 * WHY: Project cards must follow membership without destroying operator-authored layout.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureProjectsCanvasDocument } from '@backend/business/server/helper/ensure-projects-canvas-document.js';
import type { DecisionOsProject } from '@backend/business/server/helper/project-catalog.js';

function project(root: string, id: string, name: string): DecisionOsProject {
  return {
    id, name, description: '', color: '#123456', relativePath: name, root: join(root, name),
    decisionOsRoot: join(root, name, '.decision-os'), ledgers: [], available: true, diagnostic: '',
  };
}

test('adds and removes mirrored project cards while retaining geometry', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-projects-canvas-'));
  const masterDecisionOsRoot = join(root, '.decision-os');
  mkdirSync(masterDecisionOsRoot, { recursive: true });
  const first = project(root, 'one', 'One');
  const second = project(root, 'two', 'Two');
  ensureProjectsCanvasDocument({ masterDecisionOsRoot, projects: [first, second] });
  const path = join(masterDecisionOsRoot, 'projects-canvas.json');
  const stored = JSON.parse(readFileSync(path, 'utf8')) as { cards: Array<Record<string, unknown>> };
  stored.cards[0].x = 777;
  writeFileSync(path, JSON.stringify(stored));

  const updated = ensureProjectsCanvasDocument({ masterDecisionOsRoot, projects: [{ ...first, name: 'Renamed' }] });
  const cards = updated.document.cards;

  assert.equal(cards.length, 1);
  assert.equal(cards[0].id, 'project-card:one');
  assert.equal(cards[0].title, 'Renamed');
  assert.equal(cards[0].x, 777);
});
