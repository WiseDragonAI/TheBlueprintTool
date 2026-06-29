## A. Purpose

1. **Goal.** Let a watcher session target one or more ledgers inside the current workspace instead of always watching every active ledger.
2. **Reason.** A single cwd can contain ledgers with very different contexts. Separate watcher agents must be able to run from the same cwd while receiving notifications only for their assigned ledgers.
3. **Default workspace.** The watcher still resolves the decision-os workspace from the process cwd.
4. **Additional scope.** The watcher also accepts a ledger selection argument or an interactive selection before it starts watching.

---

## B. Startup Modes

1. **Explicit ledger argument.** The launcher can accept one ledger name, multiple ledger names, or `all`.
2. **Interactive TUI.** When no ledger argument is provided, the launcher opens a terminal selector before starting the watcher.
3. **All option.** The selector must include `all`, which watches every ledger discovered from the active workspace.
4. **Multi-select.** The selector must support choosing multiple ledgers in one watcher session.
5. **Non-interactive mode.** Automation can bypass the TUI by passing the ledger selection directly.

---

## C. Ledger Discovery

1. **Primary source.** Read `.decision-os/state.json` and use its `tabs[]` entries as the canonical ledger list.
2. **Fallback source.** If state is missing or invalid, scan `.decision-os/*.json` and exclude local settings files such as `.settings.json`.
3. **Display label.** Show the tab title when available, with the route id and ledger file path visible enough to disambiguate similar names.
4. **Selection value.** Store the resolved ledger file paths, not only display titles, so later route or title changes do not break the watcher.

---

## D. Watcher Routing

1. **Scoped polling.** The watcher only runs `unanswered` checks against selected ledgers.
2. **Scoped trigger payload.** When notes appear, the injected agent context includes only the selected ledger set and the pending notes from those ledgers.
3. **Parallel agents.** Three watcher agents can run from the same cwd with different ledger selections and should not receive each other's ledger notifications.
4. **Durable state.** Persist the selected ledger set in watcher-local state under `.decision-os`, along with the watcher run id and current status.

---

## E. Acceptance

1. **Single ledger.** Starting the watcher for `next-features` ignores pending notes in `specs`, `data`, and `performances`.
2. **Multiple ledgers.** Starting the watcher for `specs,next-features` watches exactly those two ledgers.
3. **All ledgers.** Starting the watcher with `all` matches the current all-ledger behavior.
4. **TUI path.** Starting without a ledger argument shows the discovered ledger list and starts only after a selection is confirmed.
5. **Workspace isolation.** All discovery and persisted watcher state remain scoped to the cwd workspace.
