/**
 * Expand the shared thread composer from its mobile voice-first state.
 * The mobile shell owns click routing, so it must apply the shared composer's
 * class and accessibility contract itself.
 */
function threadJumpControl(root) {
  return root?.querySelector?.('.thread-jump-bottom') ?? null;
}

function showThreadTextCloseControl(control) {
  control.dataset.action = 'close-thread-text';
  control.title = 'Close text input';
  control.setAttribute('aria-label', control.title);
  control.setAttribute('aria-hidden', 'false');
  control.classList.add('is-thread-text-close');
  control.hidden = false;
}

function restoreThreadJumpControl(control) {
  control.dataset.action = 'jump-thread-bottom';
  control.title = 'Jump to bottom';
  control.setAttribute('aria-label', control.title);
  control.classList.remove('is-thread-text-close');
}

export function expandMobileThreadComposer(button, root = document) {
  const composer = button?.closest('.terminal-composer');
  const draft = composer?.querySelector('.thread-draft');
  const closeControl = threadJumpControl(root);
  if (!composer || !draft || !closeControl) return false;
  composer.classList.remove('is-mobile-text-collapsed');
  button.setAttribute('aria-expanded', 'true');
  showThreadTextCloseControl(closeControl);
  draft.focus();
  return true;
}

export function collapseMobileThreadComposer(button, root = document) {
  const composer = root?.querySelector?.('.terminal-composer');
  const draft = composer?.querySelector('.thread-draft');
  const textButton = composer?.querySelector('[data-action="toggle-thread-text"]');
  if (!composer || !draft || !textButton || !button) return false;
  composer.classList.add('is-mobile-text-collapsed');
  textButton.setAttribute('aria-expanded', 'false');
  restoreThreadJumpControl(button);
  draft.blur();
  textButton.focus();
  return true;
}
