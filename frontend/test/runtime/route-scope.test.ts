/**
 * WHAT: Proves the shared canonical route identity used by canvas and compact surfaces.
 * WHY: Project ownership must survive parsing, serialization, and browser history transitions.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { projectLedgerPath, projectLedgersPath, routeScope } from '../../src/runtime/navigation/helper/route-scope.js';
import { routeCanvasMode } from '../../src/runtime/navigation/helper/route-canvas-mode.js';

test('parses global and project-scoped application routes', () => {
  assert.deepEqual(routeScope('/'), { view: 'control-room', projectId: '', ledgerId: '', zoneId: '', cardId: '' });
  assert.equal(routeScope('/projects').view, 'projects');
  assert.deepEqual(routeScope('/p/project%201/ledgers/specs'), {
    view: 'ledger', projectId: 'project 1', ledgerId: 'specs', zoneId: '', cardId: '',
  });
  assert.deepEqual(routeScope('/p/project/ledgers/specs/zones/zone-a/cards/card-a'), {
    view: 'card', projectId: 'project', ledgerId: 'specs', zoneId: 'zone-a', cardId: 'card-a',
  });
});

test('serializes canonical canvas hierarchy routes', () => {
  assert.equal(projectLedgersPath('project 1'), '/p/project%201/ledgers');
  assert.equal(projectLedgerPath('project 1', 'specs data'), '/p/project%201/ledgers/specs%20data');
  assert.equal(routeCanvasMode('/projects'), 'ledger');
  assert.equal(routeScope('/projects-canvas').view, 'projects-canvas');
  assert.equal(routeCanvasMode('/projects-canvas'), 'projects');
  assert.equal(routeCanvasMode('/p/project/ledgers'), 'ledgers');
  assert.equal(routeCanvasMode('/p/project/ledgers/specs'), 'ledger');
});
