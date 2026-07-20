/**
 * WHAT: Defines the durable operator-question contract stored on ledger cards.
 * WHY: Pipeline outputs, the card renderer, and ledger mutations must share one versioned state shape.
 */
export type CardQuestionChoice = {
  emoji: string;
  text: string;
};

export type CardQuestion = {
  id: string;
  question: string;
  choices: [CardQuestionChoice, CardQuestionChoice, CardQuestionChoice, CardQuestionChoice];
  placeholder: string;
};

export type CardQuestionResponseStatus = 'answered' | 'rejected' | 'skipped' | 'pending';

export type CardQuestionResponse = {
  status: CardQuestionResponseStatus;
  choiceIndex?: number;
  customAnswer?: string;
  updatedAt: string;
};

export type CardQuestionnaire = {
  version: 1;
  questions: CardQuestion[];
  currentQuestionId?: string;
  responses: Record<string, CardQuestionResponse>;
};

export type CardQuestionnaires = Record<string, CardQuestionnaire>;
