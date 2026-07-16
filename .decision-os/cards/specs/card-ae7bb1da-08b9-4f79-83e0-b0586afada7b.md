## RCA

The agent crashed because its stdout consumer disappeared, and the Termux Codex binary treats that ordinary broken-pipe condition as a fatal panic.

This was **not an OOM kill**.

### Failure chain

1. At **19:25:37**, the agent launched the entire backend suite:

   `npm test --prefix backend`

2. That suite includes server lifecycle and Codex subprocess integration tests. It left a large test tree running even after the tool reported completion.

3. The agent then started another verification while the full suite still owned the verification lease.

4. It removed the first test worktree while that suite was still executing. Runtime inspection subsequently showed:

   `cwd=.worktrees/json-master-projection/backend (deleted)`

5. At **19:27:52**, the supervised Decision OS server began restarting. A stale server process still owned `127.0.0.1:50150`, so every replacement crashed with:

   `EADDRINUSE: address already in use 127.0.0.1:50150`

   This happened continuously, roughly every six seconds.

6. The server that owned the active Codex run disappeared without terminating or adopting its Codex child correctly. The child became orphaned:

   - Codex PID: `21194`
   - Parent PID: `1`
   - Runtime: about 15 minutes

7. At **19:36:08**, that orphaned Codex process tried to emit another JSON event. Its stdout pipe had no reader.

8. The Codex binary panicked instead of handling `EPIPE`:

   `Abort message: 'failed printing to stdout: Broken pipe (os error 32)'`

9. Android recorded the resulting native termination:

   `Fatal signal 6 (SIGABRT)` in thread `codex-main`

### Root cause

The immediate root cause is an unhandled broken stdout pipe in the Termux Codex binary. Writing to a closed pipe invokes a Rust panic path that calls `abort()`, producing `SIGABRT`.

The system-level root cause is broken process ownership:

- The Decision OS server can die without settling its Codex children.
- The launcher forwards signals only while it remains alive.
- Orphaned server and Codex descendants survive independently.
- The supervisor starts replacements without first proving the previous process tree and port owner are gone.
- A resumed Codex process can therefore keep running with a dead stdout consumer.

### Agent-caused trigger

The agent created the conditions by running the full backend suite on the live phone while Decision OS and a real card agent were active. It then removed a worktree before that suite actually terminated and continued launching verification commands.

That violated the repository’s own verification hygiene: focused tests first, one leased verification at a time, and no removal of an active test worktree.

### Contributing defects

- `decision-os-server.mjs` does not supervise a process group; it only signals its immediate child.
- Codex aborts on `EPIPE` instead of exiting cleanly.
- The service restart path does not kill or adopt descendants before relaunching.
- The server emits “ok” before the listen failure is settled, creating misleading startup logs.
- The verification wrapper’s signal forwarding does not guarantee destruction of the complete descendant tree.
- The tool reported the full test command as completed while test processes remained alive.
- Memory pressure—about 200 MiB free and 2.5 GiB swap used—made the phone unhealthy, but it was a consequence/amplifier, **not the recorded crash cause**.

The exact recorded crash is therefore:

> Parent/server disappearance → closed stdout pipe → Codex writes JSON → `EPIPE` panic → `SIGABRT`.