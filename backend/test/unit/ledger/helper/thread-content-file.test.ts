import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatThreadMarkdown,
  parseThreadMarkdown,
  validateExternalThreadMarkdown,
} from '@backend/business/ledger/helper/thread-content-file.js';

test('thread markdown parser ignores message headings inside fenced code blocks', () => {
  const markdown = [
    '# OPERATOR',
    '<!-- decision-os:note {"id":"note-operator","timestamp":"2026-07-08T00:00:00.000Z"} -->',
    '',
    'Please inspect this captured thread:',
    '```markdown',
    '# AGENT',
    '<!-- decision-os:note {"id":"embedded","timestamp":"2026-07-08T00:01:00.000Z"} -->',
    '',
    'This is command output, not a real note.',
    '```',
    '',
    '# AGENT',
    '<!-- decision-os:note {"id":"note-agent","timestamp":"2026-07-08T00:02:00.000Z"} -->',
    '',
    'Done.',
  ].join('\n');

  const notes = parseThreadMarkdown(markdown);

  assert.equal(notes.length, 2);
  assert.equal(notes[0]?.id, 'note-operator');
  assert.equal(notes[0]?.role, 'operator');
  assert.match(String(notes[0]?.message ?? ''), /# AGENT/);
  assert.equal(notes[1]?.id, 'note-agent');
  assert.equal(notes[1]?.role, 'agent');
});

test('thread markdown parser round-trips codex artifact output with nested fences as one note', () => {
  const formatted = formatThreadMarkdown([{
    id: 'codex-run-line-3',
    role: 'agent',
    message: [
      '**Tool call** `sed -n`',
      'Status: completed',
      '',
      '````text',
      '# OPERATOR',
      '',
      '```markdown',
      '# AGENT',
      'nested output',
      '```',
      '````',
    ].join('\n'),
    timestamp: '2026-07-08T00:00:00.000Z',
    codexRunId: 'codex-skill-1-abcd',
    codexKind: 'tool_call',
    codexEventType: 'item.completed',
  }]);

  const notes = parseThreadMarkdown(formatted);

  assert.equal(notes.length, 1);
  assert.equal(notes[0]?.id, 'codex-run-line-3');
  assert.equal(notes[0]?.codexKind, 'tool_call');
  assert.match(String(notes[0]?.message ?? ''), /# OPERATOR/);
  assert.match(String(notes[0]?.message ?? ''), /# AGENT/);
});

test('external thread validation accepts stable canonical identities and an empty thread', () => {
  const markdown = formatThreadMarkdown([
    { id: 'note-a', role: 'operator', message: 'First.' },
    { id: 'note-b', role: 'agent', message: 'Second.' },
  ]);

  assert.deepEqual(validateExternalThreadMarkdown(markdown), { ok: true });
  assert.deepEqual(validateExternalThreadMarkdown(''), { ok: true });
});

test('external thread validation rejects malformed and duplicate note identities', () => {
  const duplicate = [
    '# OPERATOR',
    '<!-- decision-os:note {"id":"note-a"} -->',
    '',
    'First.',
    '',
    '# AGENT',
    '<!-- decision-os:note {"id":"note-a"} -->',
    '',
    'Second.',
  ].join('\n');

  assert.deepEqual(validateExternalThreadMarkdown('# OPERATOR\nNot metadata.\n'), {
    ok: false,
    error: 'thread_note_metadata_invalid:2',
  });
  assert.deepEqual(validateExternalThreadMarkdown(duplicate), {
    ok: false,
    error: 'thread_note_id_duplicate:note-a',
  });
});
