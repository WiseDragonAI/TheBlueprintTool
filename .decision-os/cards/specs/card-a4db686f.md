## A. Objective

1. **Define recursive discovery.** Specify how the Termux-home server detects project directories containing one or more Decision OS ledgers at any nesting depth, including beneath intermediate directories that contain no Decision OS data.
2. **Define identity.** Specify how each detected project directory becomes a project whose display name is the directory basename while its nested CWD path remains available for resolution.

---

## B. Contract

1. **Boundaries.** Define the Termux-home scan root, recursive traversal, Decision OS ledger recognition, project-root recognition, stable project identity, directory-basename display naming, ordering, refresh behavior, and duplicate handling from discovery evidence.
2. **Safety.** Define path validation and access boundaries for project-scoped requests.
3. **Compatibility.** Preserve the current single-project behavior when only one project is available.

---

## C. Exit Criteria

1. **Implementation-ready specification.** Backend and frontend work have one unambiguous contract for recursive project discovery, nested CWD resolution, and directory-basename display naming.

---

## D. Implemented Contract

1. **Recognition.** A project root contains `.decision-os/state.json`; each state entry with an `id` and `ledgerFile` becomes a project ledger.
2. **Traversal.** Discovery recursively scans beneath the master launch root, continues through intermediate directories without Decision OS data, and skips `.git`, `.decision-os`, `.worktrees`, and `node_modules`.
3. **Identity.** The stable project id is the URL-safe base64 encoding of its path relative to the master root. `relativePath` retains nested resolution context and `name` is the project directory basename.
4. **Refresh.** The server caches discovery for five seconds and invalidates the cache after a project color update.
5. **Boundary.** Requests select only ids in the server-generated catalog; unknown ids return HTTP `404`.
