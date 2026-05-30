Threads are stored as Markdown sidecar files under `.blueprinttool/threads/<ledger-name>/<thread-id>.md`. Ledger JSON keeps `threadFiles` references, while runtime reads hydrate `notes` from those files before returning data to the browser or ledger-cli command handlers.

Only two H1 section titles are valid in a thread file: `# OPERATOR` and `# AGENT`. Each H1 section is one conversation note. Optional `<!-- corev2:note {...} -->` metadata comments may preserve ids, timestamps, voice upload refs, status, and errors, but the message body remains plain Markdown below the H1 section.
