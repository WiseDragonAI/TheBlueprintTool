## A. Failed Invariant

1. **Expected:** while an existing skill is edited, the editor header cross is the sole visible close control; the still-rendered Process, picker, route, detail-rail, and editor-tools owners keep their state but hide their own crosses.
2. **Observed:** owner close controls remained visible beside the editor close because edit state was local to the editor dialog and did not reach every rendered owner.

---

## B. First Incorrect Transition

1. **Transition:** opening an existing-skill editor created the editor session without synchronizing an ownership marker onto the rendered surface that launched it.
2. **Consequence:** owner-local styling had no stable lifecycle signal, so background close controls remained independently visible.

---

## C. Failed Repair Paths

1. **Cross-dialog CSS:** `body:has(...)`, owner-sibling `:has(...)`, and inherited custom properties could not reliably project top-layer dialog state onto separate owner trees.
2. **Positional browser identity:** the served proof selected the first catalog row and reached `CLI_TOOLS`, which is legitimately ordered before the fixture skill.
3. **Non-focusable Escape target:** the mobile dismissal proof sent `Escape` to the workspace root instead of the focusable `Skill controls` rail, so it did not exercise the installed key path.

---

## D. Repair Boundary

1. **Lifecycle ownership:** the existing editor lifecycle synchronizes `is-behind-existing-skill-editor` on open, accepted close, and creator-to-existing promotion.
2. **Local presentation:** each owner hides only its own close control while marked; the editor header close remains visible. Creator mode retains owner crosses until promotion succeeds.
3. **Route preservation:** direct-detail editing retains its rendered detail owner. Edit deep links continue through normal route loading and render fresh detail state after close.

---

## E. Regression Evidence

1. **Lifecycle integration:** focused integration coverage exercises open, rejected dirty close, accepted close, creator promotion, route restoration, and marker cleanup.
2. **Served Linux Chromium:** the isolated scenario selects the fixture skill by exact rendered identity, opens each asserted owner surface, verifies computed close visibility, sends `Escape` to the focusable rail, verifies focus restoration, and covers direct-detail, deep-link, Process, picker, and creator paths.
3. **Proof boundary:** the focused lifecycle and served Linux Chromium checks passed before commit. Deployment to `dev` and operator QA remain separate delivery evidence.

---

## F. Reusable Lessons

1. **State ownership precedes styling:** a top-layer dialog cannot reliably control unrelated owner trees through CSS discovery alone; project explicit lifecycle state from the component that owns open and close transitions.
2. **Browser records require identity selectors:** catalog position is presentation order, not record identity.
3. **Keyboard proof requires the listener-reachable focus target:** interaction tests must dispatch keys through the rendered focusable surface and assert resulting focus restoration.
