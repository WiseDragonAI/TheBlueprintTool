# Generalized Trace Evidence Tool Plan and Specification

## A. Purpose

1. **Objective:** provide an agent with complete, correlated evidence from one background collection job covering one or more tests, Decision OS cards, task executions, and Codex sessions.
2. **Responsibility:** execute admitted tests, discover selected task identities, gather raw evidence, preserve event stacks, source-map those stacks during tool invocation, invoke Graphify, and produce machine-readable plus human-readable artifacts.
3. **Interpretation boundary:** the tool does not diagnose failures, identify causes, judge semantic correctness, recommend changes, or decide the first incorrect transition. The consuming agent performs those operations from the produced evidence.
4. **Generalization boundary:** the reusable core owns job supervision, leases, correlation, source mapping, Graphify execution, artifact integrity, and reports. A repository adapter owns only repository-specific discovery and raw-evidence access.

---

## B. Primary Workflows

1. **Test trace:** an agent selects one or more existing tests. The tool waits for the repository verification lease, runs the selected tests, captures their telemetry and process evidence, resolves source maps, invokes Graphify, and finalizes the report.
2. **Card discovery:** an agent selects one or more cards. The tool returns card identity, owning master task, internal task state, execution identities, session identities, and artifact availability without returning Codex session content.
3. **Task trace:** an agent selects one or more cards, executions, and sessions. The tool gathers only evidence belonging to those selected identities and packages it as a background trace job.
4. **Event query:** an agent queries a completed or active job using event filters. Query filters change only the returned view; the raw captured evidence remains complete and immutable.
5. **Early evidence access:** an agent may wait until raw evidence is finalized, begin inspection, and allow source mapping, Graphify, and report rendering to continue in the background.

---

## C. Non-Goals

1. The tool does not debug the application.
2. The tool does not infer expected behavior.
3. The tool does not classify an observed transition as correct or incorrect.
4. The tool does not mutate cards, task state, source files, tests, production state, or server state.
5. The tool does not restart the Decision OS server.
6. The tool does not treat Graphify output as runtime authority.

---

## D. Architecture

1. **CLI client:** validates syntax, submits background jobs, queries discovery data, waits for milestones, streams bounded progress, and prints artifact paths.
2. **Job supervisor:** owns job identity, phase transitions, deadlines, cancellation, child processes, durable state, recovery, and final settlement.
3. **Repository adapter:** resolves tests, cards, master tasks, executions, sessions, raw telemetry, logs, source-map manifests, and source files for one repository.
4. **Lease controller:** acquires the repository-defined verification lease before any test process starts and holds it until every selected test plus evidence stream settles.
5. **Test controller:** launches direct argv commands, maintains scope identity, captures test-runner lifecycle records, and separates results by selected test.
6. **Evidence collector:** appends raw telemetry, stdout, stderr, test events, task events, Codex JSONL, and presentation events to run-scoped durable artifacts.
7. **Stack mapper:** parses raw event stacks and resolves them against the exact build's source maps during tool invocation.
8. **Correlation controller:** groups evidence by job, test, card, task, execution, session, process, and event identity without making diagnostic judgments.
9. **Graphify adapter:** builds a sanitized corpus from the trace plus implicated source snapshots, runs a pinned Graphify version, and records all inputs and outputs.
10. **Report renderer:** writes the manifest, Markdown report, event indexes, file inventory, integrity hashes, completeness state, and Graphify inventory.

---

## E. Background Job Lifecycle

1. Every job has one durable identifier and one atomic state record.
2. The lifecycle is:

   ```text
   accepted
   → resolving_scope
   → waiting_for_lease
   → running_tests
   → collecting_evidence
   → flushing_evidence
   → evidence_ready
   → mapping_sources
   → running_graphify
   → writing_report
   → complete
   ```

3. Terminal failure phases are `failed`, `cancelled`, and `interrupted`.
4. A failure in one selected test or card scope settles that scope and preserves its evidence. It does not discard evidence from other scopes.
5. Graphify failure, source-map failure, and report-rendering failure do not rewrite test results.
6. `evidence_ready` means raw evidence is safely finalized and available to the agent before derived artifacts complete.
7. The supervisor records process identity, start time, completion time, exit code, signal, deadline, cancellation origin, and settlement status.
8. Cancellation sends `SIGTERM`, waits for a finite grace period, escalates to `SIGKILL`, flushes evidence, and finalizes a cancelled manifest.

---

## F. Batch Scope

1. One job may select multiple tests, cards, executions, and sessions.
2. Every artifact record carries its complete scope identity.
3. Results remain separated by test, card, execution, and session.
4. The job records a run-wide monotonic sequence for ingestion order and a source-local sequence for producer order.
5. Cross-scope timestamps are preserved without claiming causality between independent scopes.
6. Graphify receives the deduplicated union of implicated files across every selected scope.
7. An ambiguous selector is rejected before evidence collection begins.

---

## G. Verification Lease Contract

1. Every test process runs through the repository adapter's verification lease.
2. The Decision OS adapter uses `bin/decision-os-verify.mjs` and its direct-command admission rules.
3. The job waits when another verification owns the lease and reports `waiting_for_lease` with the wait start time.
4. The job holds the lease until all selected tests, stdout, stderr, test lifecycle events, and telemetry writers settle.
5. The lease controller applies repository concurrency limits.
6. Shell command strings are not accepted. Executables and arguments remain separate.
7. Non-test card and event discovery does not acquire the verification lease.

---

## H. Runtime Telemetry Contract

1. Runtime telemetry captures the raw stack synchronously at event emission time.
2. Runtime telemetry does not source-map the stack.
3. Runtime telemetry writes append-only records to the run-scoped destination supplied by the trace job.
4. Normal runtime behavior remains lightweight when no trace job is active.
5. A telemetry writer failure remains contained and emits a scoped collection failure without changing application control flow.
6. The minimum event contract is:

   ```ts
   type RawTelemetryEvent = {
     schemaVersion: 1;
     traceJobId: string;
     traceRunId: string;
     scopeId: string;
     testId: string | null;
     cardId: string | null;
     executionId: string | null;
     sessionId: string | null;
     eventId: string;
     sequence: number;
     emittedAt: string;
     monotonicNs: string;
     processId: number;
     threadId: number | null;
     name: string;
     phase: "started" | "completed" | "failed" | "event";
     args: unknown;
     rawStack: string;
   };
   ```

7. Event arguments follow the selected collection policy and retain a digest of the unredacted serialized value when redaction is active.
8. Malformed records remain byte-identical in raw artifacts and appear in the manifest's parse-failure inventory.

---

## I. Source Mapping Contract

1. Source mapping occurs after raw evidence collection when the trace tool runs.
2. The mapper uses the exact build identity recorded by the repository adapter.
3. Every stack retains both its raw representation and mapped representation.
4. A mapped frame contains original file, symbol, line, column, generated file, generated line, generated column, and source-map identity.
5. A mapping failure retains the raw frame and records a stable failure code plus message.
6. Missing, incompatible, and ambiguous source maps produce distinct failure codes.
7. Source maps are read-only inputs and are copied into the artifact integrity inventory by hash, not rewritten.

---

## J. Decision OS Card and Task Discovery

1. The Decision OS adapter accepts repeated card identifiers.
2. A card discovery response contains:

   - Project and ledger identity.
   - Card ID and exact title.
   - Owning master-task identity.
   - Direct subtask identities when applicable.
   - Durable card status.
   - Internal task lifecycle status.
   - Active, default, selected, predecessor, successor, and restarted execution identities.
   - Codex session IDs and provider session IDs.
   - Execution kind, phase, timestamps, model, effort, executor node, and replica.
   - JSONL, stderr, telemetry, and result artifact availability.
   - Scoped pause and durable incident references when present.

3. Card discovery returns identities and state only. It does not return card Markdown, thread bodies, Codex messages, tool output, or session content.
4. Event collection begins only after an agent selects executions, sessions, or the explicit `default`, `latest`, and `active` selectors.
5. Task evidence is filtered by durable task, execution, and session identity. File creation time is not an authoritative selector.

---

## K. Correlation and Flow Output

1. Correlation is mechanical. It groups records using explicit identities and ordering fields.
2. The tool produces:

   - Per-test timelines.
   - Per-card execution inventories.
   - Per-execution event timelines.
   - Per-session raw-event indexes.
   - Per-process sequences.
   - Stack-frame sequences for each telemetry event.

3. The tool may connect records through explicit parent identifiers supplied by the producer.
4. The tool does not infer missing causal edges from timestamps, stack similarity, naming, or source layout.
5. Missing identities and unresolved records remain visible in separate uncorrelated groups.
6. The formatted flow is a readable projection of explicit ordering and parentage, not a diagnosis.

---

## L. Graphify Contract

1. Graphify runs after raw evidence is finalized and source frames are mapped.
2. The implementation pins the official `graphifyy` package version and records the version plus license metadata.
3. The Graphify corpus contains:

   ```text
   graphify-input/
   ├── trace.json
   ├── trace.md
   ├── manifest.json
   └── files/<repository-relative source snapshots>
   ```

4. `trace.md` contains explicit links from mapped frames and event indexes to source snapshots.
5. Raw secrets, authored content, unrestricted telemetry arguments, stdout, and stderr do not enter the Graphify corpus.
6. The adapter records Graphify argv, environment policy, start time, duration, exit status, stdout, stderr, input hashes, and output hashes.
7. Expected Graphify outputs are `graph.html`, `GRAPH_REPORT.md`, and `graph.json`.
8. Graphify output enriches file and symbol relationships. It does not determine runtime ordering or test results.

---

## M. Artifact Contract

1. Every job writes:

   ```text
   <artifact-root>/<job-id>/
   ├── job.json
   ├── manifest.json
   ├── report.md
   ├── scopes.json
   ├── test-events.jsonl
   ├── telemetry.jsonl
   ├── task-events.jsonl
   ├── raw-codex.jsonl
   ├── presentation.jsonl
   ├── stdout.log
   ├── stderr.log
   ├── stacks.jsonl
   ├── source-files.json
   ├── graphify-input/
   └── graphify-out/
   ```

2. Raw artifacts are append-only during collection and immutable after `evidence_ready`.
3. Derived artifacts are written to temporary paths and atomically installed.
4. `manifest.json` records every file's path, media type, byte count, SHA-256 hash, producer, completeness, and creation time.
5. A configured resource ceiling causes the affected artifact to become `incomplete`. The manifest records the first dropped byte or record.
6. The tool never reports complete evidence when any admitted record was dropped.

---

## N. Reusable Core Interfaces

1. The repository adapter contract is:

   ```ts
   interface TraceRepositoryAdapter {
     readonly name: string;
     readonly version: string;

     discoverTests(input: TestDiscoveryInput): Promise<TestDescriptor[]>;
     resolveCards(input: CardDiscoveryInput): Promise<CardDescriptor[]>;
     resolveExecutions(input: ExecutionDiscoveryInput): Promise<ExecutionDescriptor[]>;
     resolveSessions(input: SessionDiscoveryInput): Promise<SessionDescriptor[]>;

     acquireVerificationLease(input: LeaseInput): Promise<LeaseHandle>;
     buildTestCommands(input: TestLaunchInput): Promise<TestCommand[]>;

     collectRawTelemetry(input: EvidenceScope): AsyncIterable<RawEvidenceRecord>;
     collectTaskEvents(input: EvidenceScope): AsyncIterable<RawEvidenceRecord>;
     collectCodexEvents(input: EvidenceScope): AsyncIterable<RawEvidenceRecord>;
     collectPresentationEvents(input: EvidenceScope): AsyncIterable<RawEvidenceRecord>;
     locateLogs(input: EvidenceScope): Promise<ArtifactDescriptor[]>;

     resolveBuildIdentity(input: EvidenceScope): Promise<BuildIdentity>;
     locateSourceMaps(input: BuildIdentity): Promise<SourceMapDescriptor[]>;
     resolveSourceFiles(input: MappedFrame[]): Promise<SourceFileDescriptor[]>;
   }
   ```

2. Unsupported repository capabilities return a typed `unsupported_capability` result.
3. Adapters do not render reports, invoke Graphify, supervise jobs, infer causality, or interpret evidence.
4. The core validates adapter output before accepting it into a job.

---

## O. Configuration Contract

1. A repository declares its adapter and defaults:

   ```yaml
   trace:
     adapter: ./tooling/trace-adapter.ts
     artifacts: .trace/jobs
     lease:
       strategy: repository-adapter
     telemetry:
       format: jsonl
       runIdField: traceRunId
     sourceMaps:
       strategy: build-manifest
     graphify:
       package: graphifyy
       version: <pinned-version>
       defaultScope: touched
   ```

2. Command arguments override job-level defaults without modifying repository configuration.
3. Configuration validation finishes before a background job is accepted.

---

## P. Command-Line Contract

1. The CLI help is:

   ```text
   trace-evidence — Produce complete test and task execution evidence.

   Usage:
     trace-evidence <command> [options]

   Background jobs:
     start-tests [options] -- <test-command> [args...]
         Run one or more selected tests under the repository verification lease.

     start-tasks --project <id> [--card-id <id>]... [options]
         Collect existing evidence for selected cards and executions.

     status --job <id> [--json]
         Show job phase, scope progress, process state, counts, and failures.

     wait --job <id> [--until evidence|complete] [--timeout <duration>] [--json]
         Wait for raw evidence or the complete derived report.

     cancel --job <id>
         Cancel collection and preserve all evidence already captured.

     report --job <id> [--format markdown|json]
         Print the completed report or manifest.

   Discovery:
     cards --project <id> [--card-id <id>]... [--json]
         Return card, master-task, internal status, execution, and session identities.

     sessions --project <id> [--card-id <id>]... [options]
         Return execution and session identities without session content.

     events --project <id> [--card-id <id>]... [options]
         Query events belonging only to selected task identities.

   Test selection:
     --cwd <path>
     --test-file <path>                 Repeatable.
     --test-name <pattern>              Repeatable.
     --timeout <duration>
     --env <name=value>                 Repeatable.

   Task selection:
     --card-id <id>                     Repeatable.
     --execution-id <id>                Repeatable.
     --session-id <id>                  Repeatable.
     --provider-session-id <id>         Repeatable.
     --execution <default|latest|active>
     --replica <id>
     --include-subtasks

   Event view:
     --event-type <type>                Repeatable.
     --item-type <type>                 Repeatable.
     --event-name <name>                Repeatable.
     --status <status>                  Repeatable.
     --source <source>                  Repeatable.
     --since <ISO-8601>
     --until <ISO-8601>
     --limit <n>                        Limits displayed records only.

   Trace contents:
     --stacks <raw|mapped|both>
     --source-maps <auto|path>
     --arguments <none|safe|all>
     --logs <stdout|stderr|both>
     --include-presentation
     --include-raw-codex
     --include-file-details
     --redaction <profile>
     --graphify <off|touched|all>

   Output:
     --output <directory>
     --format <markdown|json>
     --json
     --quiet
   ```

2. Repeated selectors preserve caller order in discovery output.
3. Commands return structured error codes for missing, ambiguous, unsupported, and unauthorized scopes.

---

## Q. Agent-Facing Result

1. `start-tests` and `start-tasks` immediately return:

   ```json
   {
     "version": 1,
     "jobId": "trace-...",
     "status": "accepted",
     "statusFile": ".trace/jobs/trace-.../job.json"
   }
   ```

2. `wait --until evidence` returns raw artifact paths and completeness.
3. `wait --until complete` returns the report, manifest, Graphify output, and terminal job status.
4. The report contains:

   - Submitted selectors and resolved identities.
   - Per-test results.
   - Card, master-task, execution, and session inventories.
   - Complete correlated telemetry.
   - Raw and source-mapped stacks.
   - Complete captured logs.
   - Mechanical timelines and explicit parent relationships.
   - Source-file paths, symbols, lines, columns, Git blob hashes, and tracked state.
   - Graphify invocation and output inventory.
   - Parse failures, mapping failures, dropped records, and completeness limits.

5. The report contains no diagnosis section.

---

## R. Performance Expectations

1. Raw evidence becomes available after lease wait, test duration, and stream flush.
2. Trace capture should add less than two seconds after ordinary test completion, excluding telemetry volume and storage latency.
3. Source mapping should complete within ten seconds for ordinary scoped runs.
4. Report rendering should complete within two seconds for ordinary scoped runs.
5. Graphify `touched` scope is expected to take tens of seconds.
6. Graphify repository scope may take several minutes.
7. Job status exposes phase timestamps so an agent can distinguish lease wait, test execution, evidence flush, source mapping, Graphify, and report rendering.

---

## S. Failure and Recovery Requirements

1. Invalid durable job state remains byte-identical and produces a readable supervisor incident.
2. Every child process and asynchronous collector has a finite deadline plus explicit settlement.
3. Every artifact writer contains its own failures and records the owning scope.
4. Recovery re-reads and validates the durable job state before resuming derived processing.
5. Raw evidence is never regenerated from normalized evidence.
6. A restarted supervisor may resume source mapping, Graphify, and report rendering after `evidence_ready`.
7. A test process is never silently restarted because rerunning changes the observed evidence.

---

## T. Security and Privacy

1. Discovery commands return no Codex content unless event collection is explicitly requested.
2. Credentials, prompts, authored Markdown, transcripts, tokens, and unrestricted output are excluded from Graphify input.
3. Artifact access follows repository-local filesystem permissions.
4. Redaction produces a derived report while preserving access-controlled raw evidence.
5. The manifest records the redaction profile and every excluded field class.
6. Environment variables are allowlisted before inclusion in the manifest.

---

## U. Implementation Plan

1. **Core contracts:** implement job, scope, evidence, stack, source-map, artifact, Graphify, report, and adapter types.
2. **Supervisor:** implement durable background jobs, phase transitions, deadlines, cancellation, recovery, and atomic settlement.
3. **Lease integration:** implement the reusable lease controller and the Decision OS `decision-os-verify` adapter.
4. **Test execution:** implement direct argv launch, batch scope isolation, test lifecycle capture, and stream teeing.
5. **Telemetry capture:** implement opt-in raw stack emission and run-scoped JSONL writers in shared telemetry boundaries.
6. **Decision OS discovery adapter:** implement batched card, master-task, internal-state, execution, session, artifact, and incident discovery.
7. **Decision OS evidence adapter:** implement exact task-scoped Codex JSONL, telemetry, stderr, and presentation collection.
8. **Source mapping:** implement raw stack parsing, build identification, map discovery, frame resolution, and mapping failure inventory.
9. **Correlation:** implement identity grouping, deterministic sequences, explicit-parent projections, and unresolved-record groups.
10. **Graphify:** pin the package, build the sanitized corpus, supervise extraction, and inventory outputs.
11. **Reporting:** implement Markdown, JSON, hashes, completeness, file details, and early evidence results.
12. **Reference adapter package:** extract the reusable core and publish a Node repository adapter template.
13. **Conformance suite:** require every repository adapter to pass the acceptance criteria below.
14. **Decision OS integration:** expose the CLI through `bin/`, document installation, and retain runtime artifacts under ignored trace storage.

---

## V. Acceptance Criteria

1. One job runs multiple selected tests through the repository verification lease and preserves separate results.
2. One job inspects multiple cards and returns their master tasks, internal statuses, execution IDs, and session IDs without Codex content.
3. Task evidence contains only explicitly selected cards, executions, and sessions.
4. Every captured telemetry event contains a raw emission-time stack.
5. Source mapping happens during tool invocation and preserves raw plus mapped frames.
6. Missing source maps produce explicit mapping failures without losing raw stacks.
7. stdout, stderr, telemetry, test events, task events, raw Codex events, and presentation events are durable and hashed.
8. Query filters never delete or truncate raw evidence.
9. A failed selected scope does not discard successful scopes.
10. Cancellation terminates children, flushes writers, and produces a readable manifest.
11. `evidence_ready` becomes available before Graphify completes.
12. Graphify receives only the sanitized trace and deduplicated implicated source snapshots.
13. Graphify failure leaves test results and raw evidence unchanged.
14. The report contains test results, full selected traces, logs, stacks, identities, file details, Graphify artifacts, and completeness state.
15. The report contains no diagnosis, causal judgment, remediation, or success claim beyond recorded test results.
16. A second repository can reuse the core by implementing only the repository adapter and configuration.
17. Adapter conformance proves batch isolation, lease use, raw preservation, source-map discovery, cancellation, stable identities, and partial-scope failure containment.

---

## W. Verification Plan

1. Inject passing, failing, cancelled, interrupted, and timed-out tests.
2. Run multiple tests with interleaved telemetry and prove identity separation.
3. Run multiple card scopes with overlapping sessions and prove deduplicated evidence plus separate inventories.
4. Inject malformed telemetry and prove byte preservation plus parse-failure reporting.
5. Inject telemetry-writer failure and prove the test process settles independently.
6. Capture production JavaScript stacks and prove exact TypeScript mapping against pinned source maps.
7. Remove one source map and prove raw-stack retention plus explicit failure.
8. Exceed an artifact ceiling and prove the manifest reports incomplete evidence.
9. Cancel during lease wait, test execution, evidence flush, source mapping, and Graphify.
10. Kill and restart the supervisor after `evidence_ready` and prove derived processing resumes without rerunning tests.
11. Inject Graphify failure and timeout and prove raw artifacts plus test outcomes remain unchanged.
12. Replay the same finalized evidence twice and prove identical correlation, hashes, and machine report output.
13. Run the adapter conformance suite against Decision OS and one minimal reference repository.

---

## X. Delivery Sequence

1. Deliver the reusable contracts, supervisor, artifact model, and conformance harness first.
2. Deliver test execution plus Decision OS lease integration second.
3. Deliver runtime raw-stack telemetry capture third.
4. Deliver Decision OS card, task, execution, and session adapters fourth.
5. Deliver source mapping and correlation fifth.
6. Deliver Graphify and reports sixth.
7. Prove reuse with the reference repository adapter before declaring the framework generalized.

---

## Y. Decision OS Starting Points

1. `bin/decision-os-verify.mjs` is the existing test lease authority and direct-command admission boundary.
2. `generator-cli/src/business/report/controller/run-report-mode.ts` is the existing partial report orchestrator.
3. `generator-cli/src/business/report/helper/run-node-test.ts` captures test exit status, stdout, and stderr but currently initializes telemetry as an empty array.
4. `generator-cli/src/business/report/helper/collect-telemetry-traces.ts` reads one external JSON array and does not provide run-scoped JSONL collection.
5. `generator-cli/src/business/telemetry/helper/capture-execution-stack-trace.ts` currently scrapes one bounded run-level stack from process output rather than retaining an emission-time stack per telemetry event.
6. `frontend/src/telemetry/harness.ts` and `backend/src/telemetry/harness.ts` are existing generated telemetry boundaries that require opt-in raw-stack and run-scoped writer support.
7. `shared/task-current-state-core/model.ts` defines durable execution, session, provider-session, pipeline, lifecycle, result, and artifact identities used by the Decision OS discovery adapter.

---

## Z. Implementation and Self-Debug Proof Ledger

1. **Reusable package:** `trace-evidence/` owns contracts, background supervision, artifact integrity, source mapping, mechanical correlation, Graphify execution, reports, configuration, a Decision OS adapter, and a minimal reference Node adapter.
2. **Stable launchers:** `bin/trace-evidence.mjs` exposes the generalized command and `bin/decision-os-trace.mjs` is the Decision OS alias.
3. **Repository configuration:** `trace.config.yaml` selects the adapter and defaults. `trace-evidence/trace.config.example.yaml` is the copyable repository template.
4. **Lease proof:** the Decision OS adapter launches one batch worker through `bin/decision-os-verify.mjs`; the worker admits at most three selected test processes and retains the outer lease until every process and writer settles.
5. **Self-debug finding 1:** the first detached self-run wrote no control telemetry because the worker did not inherit its trace destination. The launcher now injects a dedicated run-scoped supervisor telemetry lane.
6. **Self-debug finding 2:** initial self stacks pointed to built JavaScript without usable maps. The trace package now emits external source maps with inline sources and maps them only during derived processing.
7. **Self-debug finding 3:** Graphify initially skipped the ignored `.trace` corpus. The fixed invocation supplies `--no-gitignore`, `--code-only`, an explicit output root, and a sanitized snapshot corpus.
8. **Self-debug finding 4:** code-only Graphify extraction produced `graph.json` but not the expected human artifacts. A bounded `cluster-only --no-label` post-process now creates `graph.html` and `GRAPH_REPORT.md` without sending content to an LLM.
9. **Self-debug finding 5:** cancellation stopped the verification wrapper but orphaned its batch worker and selected test. Test and Graphify processes now own POSIX process groups, escalate `SIGTERM` to `SIGKILL`, flush writers, and settle a cancelled manifest.
10. **Successful final self-trace:** `trace-1785590195583-2fb54008-e47` ran the raw-stack test under the lease, retained supervisor stacks, source-mapped implicated TypeScript files, completed Graphify `0.9.22`, and inventoried `graph.json`, `graph.html`, and `GRAPH_REPORT.md` with no collection failure.
11. **Batch identity proof:** `trace-1785590280086-aa3c9b53-452` ran two selected tests concurrently under one lease and retained separate process records, scopes, telemetry identities, and mechanical timelines.
12. **Partial failure proof:** `trace-1785590310717-89bb6fc3-55d` retained one successful test scope beside one failed test scope while the evidence job itself completed.
13. **Cancellation proof:** `trace-1785589415488-7b21735b-1a2` terminated its selected process tree, marked the scope cancelled, retained the cancellation origin, and installed a readable manifest.
14. **Task discovery proof:** live card discovery returns the exact card and master title, subtasks, durable and internal status, execution inventory, default and active execution identities, Codex session ID, provider session ID, and artifact availability without returning session content.
15. **Explicit session evidence proof:** `trace-1785590342565-1ad2f5c2-76c` collected the selected card's explicitly authorized Codex session, four execution presentations, stderr, and task inventory into separate hashed artifacts.
16. **Automated conformance coverage:** tests inject malformed telemetry, writer failure, artifact overflow, missing/incompatible/ambiguous maps, process cancellation, process timeout, Graphify timeout, corrupt job state, derived recovery, overlapping task sessions, partial-scope isolation, deterministic correlation, and both Decision OS and reference Node adapters.
17. **Interrupted recovery and Graphify containment:** automated jobs prove that pre-evidence interruption terminates without rerunning a test and that Graphify failure preserves a successful test result plus unchanged raw stdout.
18. **Deterministic machine replay:** `report.json` contains stable selectors, scopes, results, telemetry, stacks, flow, source details, and raw artifact hashes; automated recovery renders the same finalized evidence twice and asserts byte-identical output.
19. **Current-code self-trace:** `trace-1785590846069-0fcc050f-148` completed in 1.36 seconds with one successful leased test, no failures, no parse failures, no dropped records, invocation-time source mapping, `report.json`, `report.md`, `stacks.jsonl`, `source-files.json`, `flow.json`, `graph.json`, `graph.html`, and `GRAPH_REPORT.md`.
20. **Targeted map discovery:** the Decision OS adapter probes only adjacent maps for generated files present in captured stacks; it no longer traverses unrelated repository outputs.
8. `shared/schemas/task-execution-presentation-types.ts` defines the lightweight exact-execution presentation returned to clients.
9. `ledger-cli` already exposes batched `card-read`, `codex-run-events`, task context, and master-task validation patterns that inform adapter discovery without becoming the generalized core.
10. The generalized package exposes `trace-evidence`. The Decision OS repository may expose `decision-os-trace` as a thin configured alias that selects the Decision OS adapter.
