The HTTP server must watch card Markdown sidecar files under `.blueprinttool/cards/**/*.md` and thread Markdown sidecar files under `.blueprinttool/threads/**/*.md` for the active workspace. A direct file edit must emit a server-sent event on `/api/ledger-content-events` without requiring a manual browser reload.

The browser must subscribe to this stream during boot and refresh the active ledger content when a card or thread sidecar changes, preserving the current route and viewport state.
