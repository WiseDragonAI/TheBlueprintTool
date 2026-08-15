/**
 * WHAT: Defines the pure identity-sentinel transitions for responsive master-subtask disclosure.
 * WHY: The responsive controller must own one route-local disclosure identity without a parallel boolean state.
 */

export function reconcileMasterSubtaskDisclosureIdentity(currentIdentity, renderedIdentity) {
  // WHAT: Retain expansion only when the rendered master task has the same identity.
  // WHY: A different master task must enter collapsed even after another task was expanded.
  if (String(currentIdentity ?? '') === String(renderedIdentity ?? '')) return String(currentIdentity ?? '');
  return '';
}

export function toggleMasterSubtaskDisclosureIdentity(currentIdentity, toggledIdentity) {
  const current = String(currentIdentity ?? '');
  const toggled = String(toggledIdentity ?? '');
  // WHAT: Collapse the currently expanded master task when its own toggle is activated.
  // WHY: The empty identity is the sole collapsed sentinel for the disclosure lifecycle.
  if (current === toggled) return '';
  return toggled;
}
