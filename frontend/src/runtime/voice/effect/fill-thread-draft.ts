/**
 * WHAT: Appends transcribed voice text into the active thread draft textarea.
 * WHY: Voice notes become editable operator text instead of durable audio artifacts.
 */
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function fillThreadDraft(text: string): void {
  const draft = document.querySelector('.thread-draft') as HTMLTextAreaElement | null;
  if (!draft || !text.trim()) return;
  const separator = draft.value.trim() ? '\n' : '';
  draft.value = `${draft.value}${separator}${text.trim()}`;
  draft.dispatchEvent(new Event('input', { bubbles: true }));
  telemetry('fill-thread-draft', { characters: text.trim().length });
}
