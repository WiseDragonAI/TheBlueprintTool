/**
 * WHAT: Detects keyboard events owned by canvas or responsive card editors.
 * WHY: Global shortcuts must not fire while the operator is typing card content.
 */
export function isCardEditingKeyboardTarget(target: HTMLElement | null): boolean {
  return Boolean(
    target?.closest('.card .editing,.card [contenteditable],.ledger-card-description-editor')
    || target?.closest('input,textarea,select,[contenteditable="true"]')
  );
}
