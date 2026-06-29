The HTTP server must watch card Markdown content files under `.decision-os/cards/**/*.md` and thread Markdown content files under `.decision-os/threads/**/*.md` for the active workspace. A direct file edit must emit a server-sent event on `/api/ledger-content-events` without requiring a manual browser reload.

The browser must subscribe to this stream during boot and refresh the active ledger content when a card or thread content file changes, preserving the current route and viewport state.
