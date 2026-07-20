/**
 * WHAT: Validates card-owned questionnaire data before it reaches the interactive renderer.
 * WHY: Cards and pipeline outputs are persisted JSON and must not create an invalid interaction state.
 */
import type { CardQuestionnaire, CardQuestionnaires, CardQuestionResponse } from '../../../../../shared/schemas/questionnaire-types.js';

const responseStatuses = new Set(['answered', 'rejected', 'skipped', 'pending']);

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function response(value: unknown): CardQuestionResponse | null {
  const source = record(value);
  if (!source || !responseStatuses.has(String(source.status)) || typeof source.updatedAt !== 'string') return null;
  const choiceIndex = source.choiceIndex === undefined ? undefined : Number(source.choiceIndex);
  if (choiceIndex !== undefined && (!Number.isInteger(choiceIndex) || choiceIndex < 0 || choiceIndex > 3)) return null;
  if (source.customAnswer !== undefined && typeof source.customAnswer !== 'string') return null;
  return {
    status: source.status as CardQuestionResponse['status'],
    ...(choiceIndex === undefined ? {} : { choiceIndex }),
    ...(typeof source.customAnswer === 'string' ? { customAnswer: source.customAnswer } : {}),
    updatedAt: source.updatedAt,
  };
}

export function normalizeCardQuestionnaires(value: unknown): CardQuestionnaires {
  const source = record(value);
  if (!source) return {};
  const result: CardQuestionnaires = {};
  for (const [questionnaireId, questionnaireValue] of Object.entries(source)) {
    if (!/^[A-Za-z0-9._-]+$/.test(questionnaireId)) continue;
    const questionnaireSource = record(questionnaireValue);
    if (!questionnaireSource || questionnaireSource.version !== 1 || !Array.isArray(questionnaireSource.questions)) continue;
    const questions = questionnaireSource.questions.flatMap((questionValue) => {
      const question = record(questionValue);
      if (!question || typeof question.id !== 'string' || !question.id.trim() || typeof question.question !== 'string' || typeof question.placeholder !== 'string' || !Array.isArray(question.choices) || question.choices.length !== 4) return [];
      const choices = question.choices.flatMap((choiceValue) => {
        const choice = record(choiceValue);
        return choice && typeof choice.emoji === 'string' && typeof choice.text === 'string' && choice.text.trim()
          ? [{ emoji: choice.emoji, text: choice.text }]
          : [];
      });
      if (choices.length !== 4) return [];
      return [{ id: question.id.trim(), question: question.question, placeholder: question.placeholder, choices: choices as CardQuestionnaire['questions'][number]['choices'] }];
    });
    if (questions.length !== questionnaireSource.questions.length || new Set(questions.map((question) => question.id)).size !== questions.length) continue;
    const responseSource = record(questionnaireSource.responses) ?? {};
    const responses: CardQuestionnaire['responses'] = {};
    for (const question of questions) {
      const normalized = response(responseSource[question.id]);
      if (normalized) responses[question.id] = normalized;
    }
    const currentQuestionId = typeof questionnaireSource.currentQuestionId === 'string' && questions.some((question) => question.id === questionnaireSource.currentQuestionId)
      ? questionnaireSource.currentQuestionId
      : undefined;
    result[questionnaireId] = { version: 1, questions, responses, ...(currentQuestionId ? { currentQuestionId } : {}) };
  }
  return result;
}
