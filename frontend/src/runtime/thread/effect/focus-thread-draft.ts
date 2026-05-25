/**
 * WHAT: Focuses the thread textarea after the animated panel is opened.
 * WHY: Pressing A again should put the operator directly into note-taking.
 */
export function focusThreadDraft(): void {
  const draft = document.querySelector('.thread-draft') as HTMLTextAreaElement | null;
  draft?.focus();
}
