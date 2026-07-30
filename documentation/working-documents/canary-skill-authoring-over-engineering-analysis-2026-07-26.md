## A. Correction

1. **This plan is over-engineered if it adds a skill identity, replication flag, registry, manifest, generic file API, editor document model, canary state file, relay protocol, or relay class.** The simpler anchors are the existing `SKILL.md` frontmatter name, filesystem source root, content revision, federation package snapshot, Git branch, MultiTerm process record, and Cloudflare environment.
2. **Required user-visible behavior:** from the Skills interface, an operator creates a local skill or a federated skill, clicks a skill file to edit it in an `80vw` by `95vh` modal with mature editing tools, saves without overwriting a concurrent change, and validates the work on a separately served `dev` canary connected to an isolated development relay.
3. **One path:** use source-root placement as the ownership decision, CodeMirror 6 as one callback-driven text editor, the existing skill-library routes and federation synchronizer as persistence and delivery boundaries, plus a `dev` Git worktree registered as a second MultiTerm process against a separate Cloudflare `dev` environment.

---

## B. Existing Durable Anchors

1. **Skill identity already exists.** `parseSkillFrontmatter()` reads `name`, `description`, and the instruction body from `SKILL.md`; `scanCodexSkills()` deduplicates by `name` in `backend/src/business/codex/helper/scan-codex-skills.ts:103` and `backend/src/business/codex/helper/scan-codex-skills.ts:178`. A new UUID, database row, catalog ID, or identity manifest would mirror `name`.
2. **Ownership already exists.** `CodexSkillSource` is exactly `server`, `workspace`, `user`, `system`, or `plugin`, and `candidateSkillRoots()` maps those values to filesystem roots in `backend/src/business/codex/helper/scan-codex-skills.ts:10` and `backend/src/business/codex/helper/scan-codex-skills.ts:40`. The requested replication choice can be derived from placement: a package under the server `.skills` root is federated; a package under the active workspace `.skills` root remains local.
3. **Concurrency identity already exists.** `skillRevision()` hashes the Markdown, `writeEditableSkillFile()` compares the submitted revision, and `saveCodexSkillLibrary()` returns `409` on stale content in `backend/src/business/codex/helper/scan-codex-skills.ts:136`, `backend/src/business/codex/helper/codex-skill-library.ts:151`, and `backend/src/business/codex/helper/codex-skill-library.ts:375`. An editor session record, draft manifest, or lock table would duplicate this optimistic concurrency boundary.
4. **Safe writes already exist.** `verifiedEditableFile()` proves the canonical target remains inside an editable root and rejects symlinks; `atomicWriteFile()` writes a sibling temporary file then renames it in `backend/src/business/codex/helper/codex-skill-library.ts:107` and `backend/src/business/codex/helper/codex-skill-library.ts:129`.
5. **Skill package replication already exists.** `createFederatedSkillExportIndex()` derives a complete package plus revision from files, and `importFederatedSkillSnapshot()` validates and atomically replaces a package in `backend/src/business/federation/helper/federated-library-cache.ts:132` and `backend/src/business/federation/helper/federated-library-cache.ts:228`. A second replication manifest, registry, queue, or file index would create a competing source of truth.
6. **Synchronization already exists.** `GET /api/federation/skills-manifest`, `GET /api/federation/skills-snapshot`, and `POST /api/federation/libraries/synchronize` are implemented in `backend/src/business/server/helper/create-http-server.ts:2918`, `backend/src/business/server/helper/create-http-server.ts:2926`, and `backend/src/business/server/helper/create-http-server.ts:2946`. Creation and save should invalidate the existing export index, then invoke this same synchronization boundary.
7. **The global Skills surface already has the correct catalog anchor.** `loadGlobalLibraries()` reads `GET /api/codex/server-skills`, and `serverSkillPath()` resolves a skill by name rather than by a browser-supplied path in `frontend/src/app/responsive/codex.js:38` through `frontend/src/app/responsive/codex.js:52`.
8. **The current editing boundary is already conflict-aware.** `renderSkillLibraryEditorModal()` loads one skill by name, edits its Markdown, preserves run defaults, and saves the loaded revision in `frontend/src/runtime/codex/effect/render-skill-library-editor-modal.ts:91` through `frontend/src/runtime/codex/effect/render-skill-library-editor-modal.ts:318`. Its `textarea` at `frontend/src/runtime/codex/effect/render-skill-library-editor-modal.ts:173` is the replacement point, not a reason to create another skill editor.
9. **Canary runtime identity already exists outside product state.** Git owns the `dev` code line; MultiTerm owns persistent process identity by `cwd`, command, port, URL, and description; `.decision-os/.settings.json` owns the server's relay URL. No `environments.json`, branch registry, server manifest, or runtime table is needed.
10. **Relay isolation is a deployment invariant, not a protocol feature.** `federation-relay/wrangler.toml:1` through `federation-relay/wrangler.toml:16` already binds the Worker to `FEDERATIONS` and its Durable Object migrations. A Cloudflare `dev` environment can use the same source and protocol with a distinct Worker name and Durable Object namespace.

---

## C. Remove

1. **Remove a new skill ID.** Continue addressing a skill by validated frontmatter `name`.
2. **Remove a persisted `replicated` field.** Expose a creation checkbox labeled `Replicate through federation`, use it once to select the server `.skills` root, and derive later presentation from `source`.
3. **Remove a second skill registry and manifest.** Rescan the existing roots and rebuild the existing `FederatedSkillExportIndex` after a successful write.
4. **Remove a generic arbitrary-file backend API.** The current feature edits skills through the existing identity-scoped skill-library contract. A thread attachment can later supply its own authorized read and save callbacks to the same editor UI.
5. **Remove a skill-specific editor state model beyond the current draft.** The editor component owns only text, read-only state, language, dirty state, and lifecycle disposal; skill metadata and persistence stay in `skillLibraryEditorState`.
6. **Remove a canary environment schema.** A Git `dev` branch, one dedicated worktree, one unused port, one MultiTerm registration, and local `.decision-os/.settings.json` are sufficient.
7. **Remove a development relay fork.** Add one `env.dev` deployment target to Wrangler; keep `src/index.ts`, `FederationRelay`, `FederationRelayV4`, protocol constants, migrations, tests, and API routes shared.

---

## D. Selected Editor

1. **Select CodeMirror 6**, pinned to `codemirror@6.0.2` and `@codemirror/lang-markdown@6.5.1`, under the `MIT` license. The official reference documents `basicSetup` with line numbers, undo history, folding, search, autocompletion, bracket matching, selection matching, and lint support; its view virtualizes the visible document. Sources: `https://codemirror.net/docs/ref/` and `https://www.npmjs.com/package/@codemirror/lang-markdown`.
2. **Reject Monaco for this surface.** Monaco is robust and exposes a large VS Code-derived toolbox, but its official repository states that mobile browsers are unsupported and its current ESM integration expects a bundler. Decision OS has responsive and mobile Skills routes and currently serves browser modules plus pinned vendor assets. Source: `https://github.com/microsoft/monaco-editor`.
3. **Use the existing vendor delivery pattern.** Pin the CodeMirror bundle in `frontend/assets/vendor/`, load it lazily in the same style as `frontend/src/runtime/ledger/component/render-ledger-card-git-diff.ts:24` through `frontend/src/runtime/ledger/component/render-ledger-card-git-diff.ts:37`, and record the version and license beside the asset. Do not add a site-wide bundler solely for the editor.
4. **Create one generic UI adapter.** A new `openTextFileEditor({ title, value, language, readOnly, onSave })` mounts CodeMirror, exposes its built-in editing tools, returns the current text through `onSave`, and disposes the `EditorView` on close. The implementation comment must state that a future thread attachment can open this editor by providing attachment-authorized load and save callbacks; the present change must not implement attachment persistence.
5. **Use the requested geometry.** The shared modal is `width: 80vw`, `height: 95vh`, bounded by the viewport; the mobile media rule retains the existing near-full-screen behavior. This replaces the fixed `920px` skill width at `frontend/assets/canvas/dialogs.css:543`.

---

## E. Minimal API and Replication Changes

1. **Add one create operation:** `POST /api/codex/skill-library` with `name`, `description`, `markdown`, and `replicate`. The server validates a safe name, validates frontmatter equality, rejects an existing package with `409`, resolves the target from `replicate`, creates `<target>/.skills/<name>/SKILL.md` atomically, rescans the catalog, and returns the existing `CodexSkillLibraryDetail`.
2. **Extend the existing save operation, not its identity.** Keep `PUT /api/codex/skill-library/:skillName` for project-local skills and `PUT /api/codex/server-skills/:skillName` for the global server catalog. Both continue submitting `markdown` and `revision`; the server continues rejecting browser-supplied paths.
3. **Make server-owned authoring explicit.** Replace the unconditional server read-only rule in `sourceEditability()` at `backend/src/business/codex/helper/scan-codex-skills.ts:145` with editability granted only when the request uses the unscoped server-library controller and the resolved file remains under the canonical server `.skills` root. `system` and `plugin` remain read-only.
4. **Correct export scope.** `exportableSkills()` at `backend/src/business/federation/helper/federated-library-cache.ts:103` currently scans every candidate source and can package workspace, user, system, and plugin winners. Restrict export to the canonical server `.skills` source. This makes local creation genuinely local and gives the checkbox one deterministic meaning without stored metadata.
5. **Reuse synchronization.** After a successful federated create or save, invalidate `readFederatedSkillExportIndex()` and request the existing skills-first synchronization. Return the local save as successful even when a peer is unavailable; expose synchronization as a separate result because a remote outage must not roll back a valid local file write.
6. **Document only changed contracts.** Update the API documentation for `POST /api/codex/skill-library`, the two existing save routes, `409` revision and existence conflicts, `403` protected sources, root-derived replication semantics, asynchronous peer synchronization, and canary relay isolation. Do not introduce a new relay payload or protocol version.

---

## F. Canary Boundary

1. **Create one long-lived `dev` branch from the verified `main` tip** and check it out in `.worktrees/dev`. Production remains on `main`; feature integration targets `dev` until operator promotion.
2. **Register one canary server in MultiTerm** from the `dev` worktree on verified-free port `50151`, named `decision-os-dev`, using that worktree's `bin/decision-os-server.mjs`. The existing production catalog remains owned by the registered `/home/jbb` process on `50150`.
3. **Give the canary its own catalog state.** Launch from the `dev` worktree so its `.decision-os` settings, projects, skills, incidents, execution state, and generated artifacts cannot mutate production state.
4. **Add `env.dev` to `federation-relay/wrangler.toml`.** Use Worker name `decision-os-federation-relay-dev`, a distinct `FEDERATIONS` Durable Object namespace, the same compatibility date, the same exported class, and the same migration sequence. Deploy with `wrangler deploy --env dev`; never reuse the production Durable Object binding.
5. **Point only the canary settings to the development relay.** Store the development relay URL and canary node identity in the canary worktree's ignored `.decision-os/.settings.json`; never add credentials to Git.
6. **Promotion remains explicit.** Passing canary checks does not merge `dev` into `main`, change the production MultiTerm command, deploy the production relay, or prove production behavior.

---

## G. Tradeoffs

1. **Root-derived replication prevents per-file toggling after creation.** Changing a skill from local to federated becomes a deliberate move operation with collision checks. That limitation preserves one source of truth and avoids drift between a boolean and filesystem placement.
2. **CodeMirror provides an editing toolbox, not a complete desktop IDE.** It deliberately omits Monaco's language-service surface and command breadth. The product needs Markdown skill authoring, search, undo, line navigation, folding, selection, and extensibility across responsive routes; it does not need a virtual filesystem or worker-based language server.
3. **Synchronization remains eventually delivered.** A save can complete while peers are offline. This matches the existing federation recovery boundary and avoids coupling local authoring availability to every peer.
4. **A separate canary state tree consumes disk and one port.** That cost is required to prevent `dev` tests from mutating production `.decision-os` state.
5. **A distinct relay environment incurs separate Cloudflare state and deployment management.** That cost is required because sharing the production Durable Object namespace would defeat canary isolation.

---

## H. Smallest Next Implementation

1. **First:** add the generic CodeMirror adapter and replace the existing skill `textarea`; set the modal to `80vw` by `95vh`; preserve `skillLibraryEditorState`, revision conflict handling, read-only behavior, focus restoration, and save callbacks.
2. **Second:** add `POST /api/codex/skill-library`, the global `New skill` action, and the creation checkbox that selects the workspace root or canonical server root without persisting a replication flag.
3. **Third:** permit identity-scoped server-skill saves, restrict federation export to server-root packages, invalidate the export index after create and save, and call the existing synchronization operation.
4. **Fourth:** add focused regressions for traversal and symlink rejection, duplicate identity, atomic create, stale revision, local exclusion from the manifest, federated package inclusion, offline-peer local success, editor disposal, toolbox behavior, `80vw` by `95vh` geometry, save and reload, and unchanged protected-source behavior.
5. **Fifth:** add API, relay-environment, canary-worktree, MultiTerm, rollback, and promotion documentation; then create the `dev` worktree, deploy the isolated `dev` relay, register the `50151` canary, and run served interaction checks there.
6. **Decision:** implement this sequence without new product registries, replicated flags, generic file routes, environment state models, relay protocols, or relay implementations.
