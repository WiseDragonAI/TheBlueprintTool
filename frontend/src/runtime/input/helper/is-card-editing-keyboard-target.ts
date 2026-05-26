/**
 * WHAT: Detects keyboard events owned by card title or description editors.
 * WHY: Global shortcuts must not fire while the operator is typing card content.
 */
export function isCardEditingKeyboardTarget(target: HTMLElement | null): boolean {
  return Boolean(target?.closest('.ledger-card-title.editing,.ledger-card-description-editor'));
}
