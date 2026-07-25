import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyScopedMasterTaskPlan } from '../../src/business/ledger/effect/apply-scoped-master-task-plan.js';
import { applyScopedMasterTaskProgress } from '../../src/business/ledger/effect/apply-scoped-master-task-progress.js';

type AnyRecord = Record<string, any>;

function taskWorkerFixture(): {
  ledgerJsonFile: string;
  ledger: AnyRecord;
  mutations: AnyRecord[];
  addCard: (card: AnyRecord, markdown: string) => void;
  install(): () => void;
} {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-scoped-master-task-'));
  const cardsDirectory = join(workspace, '.decision-os', 'cards', 'tasks');
  const threadsDirectory = join(workspace, '.decision-os', 'threads', 'tasks');
  mkdirSync(cardsDirectory, { recursive: true });
  mkdirSync(threadsDirectory, { recursive: true });
  const ledgerJsonFile = join(workspace, '.decision-os', 'tasks.json');
  const masterContentFile = '.decision-os/cards/tasks/master.md';
  const masterThreadFile = '.decision-os/threads/tasks/thread-master.md';
  writeFileSync(join(workspace, masterContentFile), 'Intake\n', 'utf8');
  writeFileSync(join(workspace, masterThreadFile), '# OPERATOR\n<!-- decision-os:note {\"id\":\"operator-note\",\"timestamp\":\"2026-07-25T20:00:00.000Z\"} -->\n\nCreate the graph.\n', 'utf8');
  const ledger: AnyRecord = {
    cards: [
      {
        id: 'master',
        title: 'Intake',
        status: 'todo',
        labels: ['master-task'],
        domainId: 'tasks',
        x: 60,
        y: 60,
        w: 360,
        h: 240,
        comment: { contentFile: masterContentFile },
      },
      { id: 'outside', title: 'Outside', status: 'todo', labels: [], x: 1400, y: 0, w: 300, h: 200 },
    ],
    annotations: [
      { id: 'group-a', variant: 'group', label: 'Group', x: 40, y: 40, width: 420, height: 300 },
      { id: 'zone-a', variant: 'zone', label: 'Intake', x: 0, y: 0, width: 1200, height: 900 },
    ],
    relationships: [],
    notes: { 'thread-master': [{ id: 'operator-note', role: 'operator', timestamp: '2026-07-25T20:00:00.000Z' }] },
    threadFiles: { 'thread-master': masterThreadFile },
  };
  const mutations: AnyRecord[] = [];
  const previousFetch = globalThis.fetch;
  const previousServerUrl = process.env.DECISION_OS_SERVER_URL;
  const previousProjectId = process.env.DECISION_OS_PROJECT_ID;
  const persistCardContent = (card: AnyRecord, markdown: string): void => {
    const contentFile = String(card.comment?.contentFile ?? `.decision-os/cards/tasks/${card.id}.md`);
    writeFileSync(join(workspace, contentFile), markdown, 'utf8');
    card.comment = { contentFile };
  };
  const applyMutation = (mutation: AnyRecord): void => {
    if (mutation.action === 'patch-card') {
      const card = ledger.cards.find((entry: AnyRecord) => entry.id === mutation.cardPatch.id);
      Object.assign(card, mutation.cardPatch.title ? { title: mutation.cardPatch.title } : {});
      if (mutation.cardPatch.description !== undefined) persistCardContent(card, mutation.cardPatch.description);
      if (mutation.cardPatch.labels !== undefined) card.labels = mutation.cardPatch.labels;
    }
    if (mutation.action === 'patch-region') {
      const zone = ledger.annotations.find((entry: AnyRecord) => entry.id === mutation.region.id);
      zone.label = mutation.region.label;
    }
    if (mutation.action === 'create-card') {
      const card = structuredClone(mutation.card);
      persistCardContent(card, String(card.comment?.what ?? ''));
      ledger.cards.push(card);
      ledger.threadFiles[`thread-${card.id}`] = `.decision-os/threads/tasks/thread-${card.id}.md`;
      ledger.notes[`thread-${mutation.card.id}`] = [];
      writeFileSync(join(threadsDirectory, `thread-${card.id}.md`), '', 'utf8');
    }
    if (mutation.action === 'append-note') {
      const notes = ledger.notes[mutation.note.threadId] ?? [];
      const timestamp = '2026-07-25T20:30:00.000Z';
      notes.push({ id: mutation.note.id, role: mutation.note.role, timestamp });
      ledger.notes[mutation.note.threadId] = notes;
      const threadFile = String(ledger.threadFiles[mutation.note.threadId]);
      writeFileSync(
        join(workspace, threadFile),
        `# AGENT\n<!-- decision-os:note ${JSON.stringify({ id: mutation.note.id, timestamp })} -->\n\n${mutation.note.body}\n`,
        { encoding: 'utf8', flag: 'a' },
      );
    }
    if (mutation.action === 'create-relationship') ledger.relationships.push(structuredClone(mutation.relationship));
    if (mutation.action === 'patch-geometry') {
      for (const [id, geometry] of Object.entries(mutation.geometry.cards ?? {}) as Array<[string, AnyRecord]>) {
        const card = ledger.cards.find((entry: AnyRecord) => entry.id === id);
        Object.assign(card, { x: geometry.x, y: geometry.y, w: geometry.width, h: geometry.height });
      }
      for (const [id, geometry] of Object.entries(mutation.geometry.zones ?? {}) as Array<[string, AnyRecord]>) {
        const zone = ledger.annotations.find((entry: AnyRecord) => entry.id === id);
        Object.assign(zone, geometry);
      }
    }
  };
  return {
    ledgerJsonFile,
    ledger,
    mutations,
    addCard(card, markdown) {
      persistCardContent(card, markdown);
      ledger.cards.push(card);
    },
    install() {
      process.env.DECISION_OS_SERVER_URL = 'http://127.0.0.1:50150';
      process.env.DECISION_OS_PROJECT_ID = 'project-a';
      globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
        if (!init) return new Response(JSON.stringify({ ok: true, ledger }), { status: 200 });
        const mutation = JSON.parse(String(init.body)) as AnyRecord;
        mutations.push(structuredClone(mutation));
        applyMutation(mutation);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }) as typeof fetch;
      return () => {
        globalThis.fetch = previousFetch;
        if (previousServerUrl === undefined) delete process.env.DECISION_OS_SERVER_URL;
        else process.env.DECISION_OS_SERVER_URL = previousServerUrl;
        if (previousProjectId === undefined) delete process.env.DECISION_OS_PROJECT_ID;
        else process.env.DECISION_OS_PROJECT_ID = previousProjectId;
        rmSync(workspace, { recursive: true, force: true });
      };
    },
  };
}

test('master-task-apply expands one plan into scoped publication and positioned graph mutations', async () => {
  const fixture = taskWorkerFixture();
  const restore = fixture.install();
  try {
    const result = await applyScopedMasterTaskPlan({
      ledgerJsonFile: fixture.ledgerJsonFile,
      planJson: JSON.stringify({
        masterCardId: 'master',
        title: 'Waiting timestamp RCA',
        zoneTitle: 'Waiting timestamp RCA',
        sections: [{ title: 'A. Decision', markdown: '1. **State:** Root cause proven.' }],
        subtasks: [
          { title: 'Trace', sections: [{ title: 'A. Scope', markdown: '1. **Objective:** Trace it.' }] },
          { title: 'Reproduce', sections: [{ title: 'A. Scope', markdown: '1. **Objective:** Reproduce it.' }] },
        ],
      }),
    });
    assert.equal(result.ok, true, result.ok ? undefined : result.error);
    assert.deepEqual(fixture.mutations.map((mutation) => mutation.action), [
      'patch-card',
      'patch-region',
      'create-card',
      'append-note',
      'create-relationship',
      'create-card',
      'append-note',
      'create-relationship',
      'patch-geometry',
    ]);
    const created = fixture.mutations.filter((mutation) => mutation.action === 'create-card');
    assert.equal(created.every((mutation) => mutation.card.status === 'todo'), true);
    assert.equal(created.every((mutation) => mutation.card.lifecycle.status === 'todo'), true);
    assert.equal(created.every((mutation) => mutation.card.labels.includes('subtask')), true);
    assert.equal(created.every((mutation) => /^## A\. Scope/.test(mutation.card.comment.what)), true);
    const relationships = fixture.mutations.filter((mutation) => mutation.action === 'create-relationship');
    assert.deepEqual(relationships.map((mutation) => mutation.relationship.position), [0, 1]);
    assert.equal(fixture.mutations.filter((mutation) => mutation.action === 'append-note').every((mutation) => mutation.note.role === 'agent'), true);
    if (result.ok) {
      const output = JSON.parse(result.value);
      assert.equal(output.operation, 'master-task-apply');
      assert.equal(output.outcome, 'verified');
      assert.deepEqual(output.subtasks.map((subtask: AnyRecord) => ({
        status: subtask.status,
        published: subtask.published,
        position: subtask.position,
      })), [
        { status: 'todo', published: true, position: 0 },
        { status: 'todo', published: true, position: 1 },
      ]);
      assert.deepEqual(output.verification, {
        authoritativeProjectionRead: true,
        masterContent: true,
        zoneTitle: true,
        zoneIsolation: true,
        relationshipOrder: true,
        subtaskContent: true,
        subtaskPublication: true,
        followUpRequired: false,
      });
    }
    const graphIds = new Set(['master', ...created.map((mutation) => mutation.card.id)]);
    const graphCards = fixture.ledger.cards.filter((card: AnyRecord) => graphIds.has(card.id));
    const zone = fixture.ledger.annotations.find((annotation: AnyRecord) => annotation.id === 'zone-a');
    assert.equal(graphCards.every((card: AnyRecord) => card.x >= zone.x && card.y >= zone.y && card.x + card.w <= zone.x + zone.width && card.y + card.h <= zone.y + zone.height), true);
    assert.equal(fixture.ledger.cards.find((card: AnyRecord) => card.id === 'outside').x < zone.x, true);
  } finally {
    restore();
  }
});

test('master-task-progress uses scoped card patches and one agent reply after lifecycle preflight', async () => {
  const fixture = taskWorkerFixture();
  fixture.addCard({ id: 'child', title: 'Child', status: 'done', labels: ['subtask'], x: 500, y: 60, w: 340, h: 380 }, 'Child\n');
  fixture.ledger.relationships.push({ id: 'rel-child', from: 'master', to: 'child', label: 'subtask', position: 0 });
  fixture.ledger.threadFiles['thread-child'] = '.decision-os/threads/tasks/thread-child.md';
  fixture.ledger.notes['thread-child'] = [];
  const restore = fixture.install();
  try {
    const result = await applyScopedMasterTaskProgress({
      ledgerJsonFile: fixture.ledgerJsonFile,
      planJson: JSON.stringify({
        masterCardId: 'master',
        updates: [
          { cardId: 'master', sections: [{ title: 'A. Result', markdown: '1. **State:** Reconciled.' }], labels: ['analysis'] },
          { cardId: 'child', sections: [{ title: 'A. Result', markdown: '1. **State:** Verified.' }], labels: ['proof'] },
        ],
        verifiedSubtaskIds: ['child'],
        reply: 'Scoped progress persisted.',
      }),
    });
    assert.equal(result.ok, true, result.ok ? undefined : result.error);
    assert.deepEqual(fixture.mutations.map((mutation) => mutation.action), ['patch-card', 'patch-card', 'append-note']);
    assert.deepEqual(fixture.mutations[0].cardPatch.labels, ['analysis', 'master-task']);
    assert.deepEqual(fixture.mutations[1].cardPatch.labels, ['proof', 'subtask']);
    assert.match(fixture.mutations[0].cardPatch.description, /^## A\. Result/);
    assert.equal(fixture.mutations[2].note.role, 'agent');
    if (result.ok) {
      const output = JSON.parse(result.value);
      assert.equal(output.operation, 'master-task-progress');
      assert.equal(output.outcome, 'verified');
      assert.deepEqual(output.updatedCards, [
        { cardId: 'master', title: 'Intake', status: 'todo', contentVerified: true, labels: ['analysis', 'master-task'] },
        { cardId: 'child', title: 'Child', status: 'done', contentVerified: true, labels: ['proof', 'subtask'] },
      ]);
      assert.deepEqual(output.subtasks, [{ cardId: 'child', status: 'done', position: 0, verified: true }]);
      assert.deepEqual(output.reply, {
        noteId: output.replyNoteId,
        threadId: 'thread-master',
        verified: true,
      });
      assert.deepEqual(output.gate, { ready: true, discrepancies: [] });
      assert.deepEqual(output.verification, {
        authoritativeProjectionRead: true,
        updatedContent: true,
        updatedLabels: true,
        reply: true,
        lifecycleGate: true,
        followUpRequired: false,
      });
    }
  } finally {
    restore();
  }
});
