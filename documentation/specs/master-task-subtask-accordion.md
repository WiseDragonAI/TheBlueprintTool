# Master-Task Subtask Accordion

## A. Scope

1. This accepted frontend contract governs the responsive Control Room disclosure that presents a master task's visible subtasks.
2. The disclosure preserves the established subtask navigation, durable status, completion, persistence, execution-refresh, and narrative ordering behavior.

---

## B. Disclosure Lifecycle

1. A master task with visible subtasks renders collapsed on its first entry.
2. Toggling the disclosure expands or collapses the same master-task identity.
3. Rendering the same master task again retains its current expanded or collapsed state.
4. Leaving the master-task view clears the disclosure identity; reopening that master task starts collapsed.
5. A different master-task identity starts collapsed even when the preceding master task was expanded.

---

## C. Visible Subtask Contract

1. Only subtasks whose exact `hidden` value is not `true` are visible in the disclosure.
2. Every visible subtask row remains mounted while the disclosure is collapsed and while it is expanded.
3. Mounted rows retain the existing subtask-row structure, identity datasets, title, durable-status label, order, navigation behavior, completion behavior, persistence path, and execution decoration compatibility.
4. The zero-visible-subtask path retains the existing heading and empty container behavior.

---

## D. Heading, Toggle, and Region Semantics

1. A non-empty disclosure renders one `section.master-subtask-disclosure` containing `h2.master-subtask-disclosure-heading > button.master-subtask-disclosure-toggle`.
2. The toggle button is the heading's sole child.
3. The toggle has a stable id scoped to the master-task identity and an `aria-controls` value equal to the disclosure panel's stable id.
4. The controlled panel has `role="region"` and an `aria-labelledby` value equal to the toggle id.
5. Expanded state is synchronized in both directions through the disclosure root's `data-expanded`, the button's `aria-expanded`, the panel's `aria-hidden`, and the panel's `inert` state.
6. Native pointer, Enter, and Space activation changes the disclosure state without changing the mounted visible rows.

---

## E. Motion and Layout

1. The disclosure uses a compact bordered surface and a visible focus treatment for its toggle.
2. The panel transition changes from `0fr` when collapsed to `1fr` when expanded using `--motion-disclosure` and `--ease-out`.
3. The disclosure chevron uses the same motion tokens and reflects expanded state.
4. The panel inner wrapper has `min-height: 0` and clips overflow so collapsed content has no exposed height.
5. Nested subtask rows have `12px` padding, bounded dividers, and no terminal-row margin.
6. Reduced-motion preferences remove both panel and chevron transitions.

---

## F. Acceptance Boundary

1. This page defines product and accessibility behavior only.
2. Fixture counts, screenshots, labels, commits, delivery receipts, and operational evidence are outside this specification.
