/**
 * Expand the shared thread composer from its mobile voice-first state.
 * The mobile shell owns click routing, so it must apply the shared composer's
 * class and accessibility contract itself.
 */
export function expandMobileThreadComposer(button) {
  const composer = button?.closest('.terminal-composer');
  const draft = composer?.querySelector('.thread-draft');
  if (!composer || !draft) return false;
  composer.classList.remove('is-mobile-text-collapsed');
  button.setAttribute('aria-expanded', 'true');
  draft.focus();
  return true;
}
