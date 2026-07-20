/**
 * WHAT: Renders Senior's operator questionnaire as a native, reusable card widget.
 * WHY: Pipeline analysis must stop at a durable human gate without sending unanswered questions downstream.
 */
import type { CardQuestionnaire, CardQuestionnaires, CardQuestionResponseStatus, CardQuestionVoiceNote } from '../../../../../shared/schemas/questionnaire-types.js';
import { state } from '../../state.js';
import { cancelVoiceRecording } from '../../voice/controller/cancel-voice-recording.js';
import { startVoiceRecording } from '../../voice/controller/start-voice-recording.js';
import { stopVoiceRecording } from '../../voice/controller/stop-voice-recording.js';
import { controlDock } from '../../voice/component/control-dock.js';
import { commitActiveLedgerMutation } from '../effect/commit-active-ledger-mutation.js';
import { transcribeQuestionnaireVoice } from '../effect/transcribe-questionnaire-voice.js';
import { normalizeCardQuestionnaires } from '../helper/card-questionnaire-state.js';
import type { LedgerMarkdownBlock } from '../helper/parse-ledger-card-markdown.js';

type QuestionBlock = Extract<LedgerMarkdownBlock, { kind: 'questions' }>;
export type QuestionnairesChangeHandler = (questionnaires: CardQuestionnaires) => Promise<boolean>;

type QuestionRendererOptions = {
  cardId?: string;
  questionnaireCardId?: string;
  questionnaires?: unknown;
  mediaSurface?: 'card' | 'detail' | 'thread';
  onQuestionnairesChange?: QuestionnairesChangeHandler;
};

const choiceKeys = ['W', 'E', 'S', 'D'];
const microphoneIcon = '<svg class="terminal-button__icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6"/></svg>';

function cloneQuestionnaire(questionnaire: CardQuestionnaire): CardQuestionnaire {
  return JSON.parse(JSON.stringify(questionnaire)) as CardQuestionnaire;
}

function actionButton(label: string, className: string, shortcut: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `questionnaire-action ${className}`;
  const text = document.createElement('span');
  text.textContent = label;
  const key = document.createElement('kbd');
  key.textContent = shortcut;
  button.append(text, key);
  return button;
}

function nextQuestionId(questionnaire: CardQuestionnaire, currentId: string): string {
  const currentIndex = questionnaire.questions.findIndex((question) => question.id === currentId);
  const ordered = questionnaire.questions.slice(currentIndex + 1).concat(questionnaire.questions.slice(0, currentIndex + 1));
  return ordered.find((question) => !questionnaire.responses[question.id] || questionnaire.responses[question.id].status === 'pending')?.id
    ?? ordered[0]?.id
    ?? currentId;
}

function responseLabel(questionnaire: CardQuestionnaire, questionId: string): string {
  const response = questionnaire.responses[questionId];
  if (!response || response.status === 'pending') return 'Pending';
  if (response.status === 'rejected') return 'Irrelevant';
  if (response.status === 'skipped') return 'Skipped';
  if (typeof response.choiceIndex === 'number') return questionnaire.questions.find((question) => question.id === questionId)?.choices[response.choiceIndex]?.text ?? 'Answered';
  return response.customAnswer?.trim() || 'Answered';
}

async function defaultPersist(cardId: string, questionnaires: CardQuestionnaires): Promise<boolean> {
  const card = state.activeLedger?.cards?.find((entry: Record<string, unknown>) => String(entry.id ?? '') === cardId) as Record<string, unknown> | undefined;
  const previous = card?.questionnaires;
  if (card) card.questionnaires = questionnaires;
  const committed = await commitActiveLedgerMutation({ action: 'patch-card', cardPatch: { id: cardId, questionnaires } });
  if (!committed && card) card.questionnaires = previous;
  return committed;
}

export function renderLedgerCardQuestions(block: QuestionBlock, options: QuestionRendererOptions = {}): HTMLElement {
  const root = document.createElement('section');
  root.className = 'ledger-card-questionnaire';
  root.dataset.questionnaireId = block.questionnaireId;
  root.tabIndex = 0;

  if (options.mediaSurface === 'thread' && !options.questionnaireCardId) {
    const title = document.createElement('strong');
    title.textContent = block.title;
    const reference = document.createElement('p');
    reference.className = 'questionnaire-thread-reference';
    reference.textContent = 'Open the card to answer these operator questions.';
    root.append(title, reference);
    return root;
  }

  const cardId = String(options.questionnaireCardId ?? options.cardId ?? '');
  let questionnaires = normalizeCardQuestionnaires(options.questionnaires);
  let questionnaire = questionnaires[block.questionnaireId];
  if (!cardId || !questionnaire) {
    root.dataset.state = 'unavailable';
    const title = document.createElement('strong');
    title.textContent = block.title;
    const error = document.createElement('p');
    error.className = 'questionnaire-empty';
    error.textContent = !cardId ? 'Open the owning card to answer these questions.' : `Questionnaire “${block.questionnaireId}” is not defined on this card.`;
    root.append(title, error);
    return root;
  }

  questionnaire = cloneQuestionnaire(questionnaire);
  const drafts: Record<string, string> = {};
  let activeQuestionId = questionnaire.currentQuestionId && questionnaire.questions.some((question) => question.id === questionnaire.currentQuestionId)
    ? questionnaire.currentQuestionId
    : questionnaire.questions.find((question) => !questionnaire.responses[question.id] || questionnaire.responses[question.id].status === 'pending')?.id ?? questionnaire.questions[0]?.id ?? '';
  let notice = '';
  let persistSequence = 0;
  let saving = false;
  let voiceBusy = false;

  async function persist(next: CardQuestionnaire, failureMessage: string): Promise<void> {
    if (saving) return;
    saving = true;
    const sequence = ++persistSequence;
    const previous = questionnaire;
    questionnaire = next;
    questionnaires = { ...questionnaires, [block.questionnaireId]: next };
    render();
    const committed = await (options.onQuestionnairesChange
      ? options.onQuestionnairesChange(questionnaires)
      : defaultPersist(cardId, questionnaires)).catch(() => false);
    if (!committed && sequence === persistSequence) {
      questionnaire = previous;
      questionnaires = { ...questionnaires, [block.questionnaireId]: previous };
      notice = failureMessage;
    }
    saving = false;
    render();
  }

  function withCurrent(next: CardQuestionnaire, questionId: string): CardQuestionnaire {
    return { ...next, currentQuestionId: questionId };
  }

  function submit(status: CardQuestionResponseStatus, choiceIndex?: number, customAnswer?: string): void {
    if (saving) return;
    const nextId = nextQuestionId(questionnaire, activeQuestionId);
    const response = {
      status,
      ...(choiceIndex === undefined ? {} : { choiceIndex }),
      ...(customAnswer ? { customAnswer } : {}),
      updatedAt: new Date().toISOString(),
    };
    const next = withCurrent({ ...cloneQuestionnaire(questionnaire), responses: { ...questionnaire.responses, [activeQuestionId]: response } }, nextId);
    activeQuestionId = nextId;
    notice = '';
    void persist(next, 'The answer could not be saved. Server-confirmed state was restored.');
  }

  function selectQuestion(questionId: string): void {
    if (saving) return;
    activeQuestionId = questionId;
    notice = '';
    void persist(withCurrent(cloneQuestionnaire(questionnaire), questionId), 'The selected question could not be saved.');
  }

  function render(): void {
    const question = questionnaire.questions.find((entry) => entry.id === activeQuestionId) ?? questionnaire.questions[0];
    root.replaceChildren();
    root.dataset.state = saving ? 'saving' : voiceBusy ? 'transcribing' : 'ready';
    if (!question) {
      const empty = document.createElement('p');
      empty.className = 'questionnaire-empty';
      empty.textContent = 'This questionnaire has no questions.';
      root.append(empty);
      return;
    }

    const answered = questionnaire.questions.filter((entry) => questionnaire.responses[entry.id]?.status === 'answered').length;
    const header = document.createElement('header');
    header.className = 'questionnaire-header';
    const identity = document.createElement('div');
    const eyebrow = document.createElement('span');
    eyebrow.textContent = block.title;
    const heading = document.createElement('strong');
    heading.textContent = 'Questions';
    identity.append(eyebrow, heading);
    const progressText = document.createElement('span');
    progressText.className = 'questionnaire-progress-count';
    progressText.textContent = `${answered}/${questionnaire.questions.length} answered`;
    header.append(identity, progressText);
    const progressTrack = document.createElement('div');
    progressTrack.className = 'questionnaire-progress-track';
    const progressBar = document.createElement('span');
    progressBar.style.width = `${questionnaire.questions.length ? (answered / questionnaire.questions.length) * 100 : 0}%`;
    progressTrack.append(progressBar);

    const layout = document.createElement('div');
    layout.className = 'questionnaire-layout';
    const main = document.createElement('div');
    main.className = 'questionnaire-main';
    const card = document.createElement('article');
    card.className = 'questionnaire-question-card';
    const questionTop = document.createElement('div');
    questionTop.className = 'questionnaire-question-top';
    const source = document.createElement('span');
    source.className = 'questionnaire-source';
    source.textContent = 'LLM → operator';
    const later = document.createElement('button');
    later.type = 'button';
    later.className = 'questionnaire-later';
    later.textContent = 'ANSWER LATER';
    later.disabled = saving;
    later.onclick = () => {
      const nextId = nextQuestionId(questionnaire, activeQuestionId);
      activeQuestionId = nextId;
      void persist(withCurrent(cloneQuestionnaire(questionnaire), nextId), 'The selected question could not be saved.');
    };
    questionTop.append(source, later);
    const questionText = document.createElement('h3');
    questionText.textContent = question.question;
    card.append(questionTop, questionText);

    const choices = document.createElement('div');
    choices.className = 'questionnaire-choices';
    const currentResponse = questionnaire.responses[question.id];
    question.choices.forEach((choice, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'questionnaire-choice';
      button.classList.toggle('is-selected', currentResponse?.status === 'answered' && currentResponse.choiceIndex === index);
      button.setAttribute('aria-pressed', String(currentResponse?.status === 'answered' && currentResponse.choiceIndex === index));
      button.disabled = saving;
      const emoji = document.createElement('span');
      emoji.className = 'questionnaire-choice-emoji';
      emoji.textContent = choice.emoji;
      const text = document.createElement('span');
      text.className = 'questionnaire-choice-text';
      text.textContent = choice.text;
      const key = document.createElement('kbd');
      key.textContent = choiceKeys[index];
      button.append(emoji, text, key);
      button.onclick = () => submit('answered', index);
      choices.append(button);
    });

    const textarea = document.createElement('textarea');
    textarea.className = 'questionnaire-notes';
    textarea.placeholder = question.placeholder;
    textarea.value = drafts[question.id] ?? currentResponse?.customAnswer ?? '';
    textarea.rows = 4;
    textarea.disabled = saving;
    textarea.oninput = () => { drafts[question.id] = textarea.value; };

    const voiceTools = document.createElement('div');
    voiceTools.className = 'questionnaire-voice-tools';
    const record = document.createElement('button');
    record.type = 'button';
    record.className = 'terminal-button terminal-button--send terminal-button--stack questionnaire-record';
    record.setAttribute('aria-label', 'Record a voice answer');
    record.innerHTML = `${microphoneIcon}<span class="terminal-button__label">VOICE ANSWER</span>`;
    record.disabled = saving || voiceBusy;
    const voice = document.createElement('section');
    voice.className = 'questionnaire-voice-capture agent-chat';
    voice.hidden = true;
    voice.innerHTML = `<div class="voice-panel"><span class="voice-status" aria-live="polite"></span>${controlDock()}</div>`;
    voice.querySelector('.voice-action--run')?.remove();
    voice.querySelector('.voice-action--pipeline')?.remove();
    record.onclick = async () => {
      voice.hidden = false;
      record.disabled = true;
      await startVoiceRecording({ surfaceRoot: voice });
      if (!state.voice.recording) record.disabled = false;
    };
    voice.querySelector('[data-action="voice-cancel"]')?.addEventListener('click', (event) => {
      event.stopPropagation();
      cancelVoiceRecording();
      voice.hidden = true;
      record.disabled = false;
    });
    voice.querySelector('[data-action="voice-stop"]')?.addEventListener('click', (event) => {
      event.stopPropagation();
      voiceBusy = true;
      record.disabled = true;
      void stopVoiceRecording({
        onCaptured: async (audio) => {
          const result = await transcribeQuestionnaireVoice(audio);
          const timestamp = new Date().toISOString();
          if (!result.voiceFileRef) {
            voiceBusy = false;
            notice = result.error ?? 'The voice answer could not be saved.';
            render();
            return false;
          }
          const voiceNote: CardQuestionVoiceNote = {
            id: globalThis.crypto?.randomUUID?.() ?? `voice-${Date.now()}`,
            voiceFileRef: result.voiceFileRef,
            transcript: result.transcript,
            status: result.ok ? 'transcribed' : 'failed',
            createdAt: timestamp,
            updatedAt: timestamp,
            ...(result.error ? { error: result.error } : {}),
          };
          const next = cloneQuestionnaire(questionnaire);
          next.voiceNotes = {
            ...(next.voiceNotes ?? {}),
            [question.id]: [...(next.voiceNotes?.[question.id] ?? []), voiceNote],
          };
          if (result.transcript) {
            const currentDraft = drafts[question.id] ?? currentResponse?.customAnswer ?? '';
            drafts[question.id] = [currentDraft.trim(), result.transcript].filter(Boolean).join('\n\n');
          }
          voiceBusy = false;
          notice = result.ok ? 'Voice answer transcribed and saved to this question.' : 'The audio was saved to this question, but transcription failed.';
          await persist(next, 'The voice answer could not be attached to this question.');
          return result.ok;
        },
      });
    });
    voiceTools.append(record, voice);

    const voiceNotes = questionnaire.voiceNotes?.[question.id] ?? [];
    const voiceHistory = document.createElement('div');
    voiceHistory.className = 'questionnaire-voice-history';
    voiceNotes.forEach((voiceNote, index) => {
      const item = document.createElement('article');
      item.className = 'questionnaire-voice-note';
      item.dataset.status = voiceNote.status;
      const label = document.createElement('strong');
      label.textContent = `VOICE ${String(index + 1).padStart(2, '0')}`;
      const transcript = document.createElement('p');
      transcript.textContent = voiceNote.transcript || voiceNote.error || 'Transcription unavailable.';
      item.append(label, transcript);
      voiceHistory.append(item);
    });
    const actions = document.createElement('div');
    actions.className = 'questionnaire-actions';
    const irrelevant = actionButton('IRRELEVANT', 'is-irrelevant', 'X');
    irrelevant.onclick = () => submit('rejected');
    irrelevant.disabled = saving;
    const next = actionButton('NEXT QUESTION', 'is-next', 'C');
    next.onclick = () => submit('skipped');
    next.disabled = saving;
    const custom = actionButton('CUSTOM ANSWER', 'is-custom', 'Ctrl+Enter');
    custom.disabled = saving || !textarea.value.trim();
    textarea.oninput = () => {
      drafts[question.id] = textarea.value;
      custom.disabled = saving || !textarea.value.trim();
    };
    custom.onclick = () => { if (textarea.value.trim()) submit('answered', undefined, textarea.value.trim()); };
    actions.append(irrelevant, next, custom);

    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'questionnaire-copy';
    copy.textContent = 'COPY Q&A';
    copy.onclick = async () => {
      const answer = responseLabel(questionnaire, question.id);
      await navigator.clipboard?.writeText(`Question: ${question.question}\nAnswer: ${answer}`);
      notice = 'Question and answer copied.';
      render();
    };
    main.append(card, choices, textarea, voiceTools);
    if (voiceNotes.length) main.append(voiceHistory);
    main.append(actions, copy);

    const queue = document.createElement('aside');
    queue.className = 'questionnaire-queue';
    const queueHeading = document.createElement('strong');
    queueHeading.textContent = 'Queue';
    queue.append(queueHeading);
    questionnaire.questions.forEach((entry, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'questionnaire-queue-item';
      button.classList.toggle('is-active', entry.id === question.id);
      button.dataset.status = questionnaire.responses[entry.id]?.status ?? 'pending';
      button.disabled = saving;
      const number = document.createElement('span');
      number.textContent = String(index + 1).padStart(2, '0');
      const body = document.createElement('span');
      const label = document.createElement('b');
      label.textContent = entry.question;
      const status = document.createElement('small');
      status.textContent = responseLabel(questionnaire, entry.id);
      body.append(label, status);
      button.append(number, body);
      button.onclick = () => selectQuestion(entry.id);
      queue.append(button);
    });
    layout.append(main, queue);

    root.append(header, progressTrack, layout);
    if (notice) {
      const status = document.createElement('p');
      status.className = 'questionnaire-notice';
      status.textContent = notice;
      root.append(status);
    }
  }

  root.onkeydown = (event) => {
    if (saving) return;
    if (state.voice.recording && state.voice.surfaceRoot instanceof HTMLElement && root.contains(state.voice.surfaceRoot)) return;
    const target = event.target as HTMLElement;
    const editing = target.matches('textarea, input, [contenteditable="true"]');
    if (editing) {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        const value = (target as HTMLTextAreaElement).value.trim();
        if (value) { event.preventDefault(); submit('answered', undefined, value); }
      }
      return;
    }
    const key = event.key.toUpperCase();
    const choiceIndex = choiceKeys.indexOf(key);
    if (choiceIndex >= 0) { event.preventDefault(); submit('answered', choiceIndex); return; }
    if (key === 'X') { event.preventDefault(); submit('rejected'); }
    if (key === 'C') { event.preventDefault(); submit('skipped'); }
  };

  render();
  return root;
}
