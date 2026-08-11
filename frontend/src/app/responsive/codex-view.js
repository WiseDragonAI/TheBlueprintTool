/**
 * WHAT: Switches the responsive Codex library between catalog and detail views.
 * WHY: One modal hierarchy must remain usable at every viewport width.
 */
export function setMobileCodexView(root, view, context = {}) {
  const detail = view === 'detail';
  for (const selector of ['.codex-tabs', '.codex-library-controls', '.process-message', '.process-library']) {
    const node = root.querySelector(selector);
    if (node) node.hidden = detail;
  }
  const detailNode = root.querySelector('.process-detail');
  if (detailNode) detailNode.hidden = !detail;
  const title = root.querySelector('#process-title');
  if (title) title.textContent = detail ? (context.detailTitle || 'Details') : context.global ? (context.libraryTitle || 'Library') : 'Process card';
  const eyebrow = root.querySelector('.process-modal .eyebrow');
  if (eyebrow) eyebrow.textContent = detail || context.global ? (context.libraryTitle || 'Library') : 'Card processing';
}

/**
 * WHAT: Settles every full-screen Codex surface owned by the route being left.
 * WHY: A fixed route surface must not remain above the destination after navigation commits.
 */
export function closeCodexRouteScreens(root = document) {
  root.querySelectorAll('.codex-app-screen').forEach((screen) => {
    screen.close();
    screen.classList.remove('codex-app-screen');
  });
}
