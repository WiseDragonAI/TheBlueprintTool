## A. Objective

1. **Change** the thread Codex launch control label to uppercase `RUN`.
2. **Render** the right chevron as an inline SVG using the existing `terminal-button__icon` contract.
3. **Reuse** the Voice widget styling boundary through `thread-action-button`: shared neutral surface with only the icon and label colored green.
4. **Record** the contradicted design claim and reference-component fidelity rule.

---

## B. Acceptance

1. **DOM:** the launch button contains the SVG chevron, uppercase `RUN` label, and `thread-action-button` hook.
2. **CSS:** `.thread-codex-button` does not override the shared background or shell control.
3. **Behavior:** `data-action="process-thread-codex"` and Codex model and effort bindings remain unchanged.