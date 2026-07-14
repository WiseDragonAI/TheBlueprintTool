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
