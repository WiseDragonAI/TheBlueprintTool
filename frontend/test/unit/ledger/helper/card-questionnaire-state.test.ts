import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCardQuestionnaires } from '../../../../src/runtime/ledger/helper/card-questionnaire-state.js';

const choices = [
  { emoji: '🧭', text: 'Use the existing flow' },
  { emoji: '🧱', text: 'Create a dedicated flow' },
  { emoji: '⚖️', text: 'Combine both flows' },
  { emoji: '🧪', text: 'Validate with a prototype' },
];

test('normalizes a versioned four-choice questionnaire and its durable response', () => {
  const value = normalizeCardQuestionnaires({ clarification: {
    version: 1,
    contextRevision: 'sha256:context-a',
    questions: [{ id: 'scope', question: 'Which boundary should own this behavior?', choices, placeholder: 'Add constraints…' }],
    currentQuestionId: 'scope',
    responses: { scope: { status: 'answered', choiceIndex: 1, updatedAt: '2026-07-20T00:00:00.000Z' } },
  } });
  assert.equal(value.clarification.questions[0].choices.length, 4);
  assert.equal(value.clarification.responses.scope.choiceIndex, 1);
});

test('keeps question-owned voice notes inside the questionnaire state', () => {
  const value = normalizeCardQuestionnaires({ clarification: {
    version: 1,
    contextRevision: 'sha256:context-a',
    questions: [{ id: 'scope', question: 'Which boundary should own this behavior?', choices, placeholder: 'Add constraints…' }],
    responses: {},
    voiceNotes: { scope: [{
      id: 'voice-a',
      voiceFileRef: '/workspace/.decision-os/voice-uploads/voice-a.wav',
      transcript: 'Keep the answer on the question.',
      status: 'transcribed',
      createdAt: '2026-07-20T00:00:00.000Z',
      updatedAt: '2026-07-20T00:00:01.000Z',
    }] },
  } });
  assert.equal(value.clarification.voiceNotes?.scope[0].transcript, 'Keep the answer on the question.');
});

test('drops malformed questionnaires instead of exposing partial interaction state', () => {
  const value = normalizeCardQuestionnaires({ clarification: {
    version: 1,
    contextRevision: 'sha256:context-a',
    questions: [{ id: 'scope', question: 'Which boundary?', choices: choices.slice(0, 3), placeholder: '' }],
    responses: {},
  } });
  assert.deepEqual(value, {});
});
