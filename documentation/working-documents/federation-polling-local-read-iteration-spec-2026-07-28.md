# Federation Polling and Backend-Local Read Iteration

- **Keep frontend polling unchanged:** the frontend continues polling its backend every `900–1000ms`.

- **Every poll stops at that backend:** polling GETs must never call the relay, proxy another backend, start reconciliation, or scan relay state.

- **Serve polls from local state:** the backend uses its authoritative project state, replicated task store, cached content, execution artifacts, and live-presentation cache.

- **Keep task-state synchronization push-driven:** a task or execution transition is committed locally, pushed through the relay once, and merged by participating backends.

- **Make live execution output push-driven between backends:** the executor pushes normalized log changes to one cache per receiving backend; all frontend clients poll that cache.

- **Make traffic independent of frontend count:** one hundred clients polling the same backend must generate the same relay traffic as one client.

- **Separate availability from connectivity:** projects and tasks remain available when valid local state exists; relay status is reported independently as `connected`, `recovering`, or `offline`.

- **Never block because the relay is offline:** relay loss must not pause project runtimes, create project-wide `503` responses, or change task workflow status.

- **Preserve offline operation:** hosted projects remain readable and writable, locally assigned executions continue, and hydrated remote tasks remain readable.

- **Queue offline mutations:** remote-replica task changes commit locally, return `publicationPending: true`, and converge after reconnection.

- **Scope unavailable operations:** an execution assigned to an unreachable node fails only that command; missing remote content affects only that resource.

- **Persist the remote project catalog:** after a backend restart without relay access, previously hydrated remote projects and tasks must remain listed and readable.

- **Move reconciliation out of HTTP reads:** reconciliation runs once per project after connection, catalog change, detected state gap, or explicit operator synchronization.

- **Contain failures:** invalid remote frames and corrupt replica caches affect only their federation scope; unrelated projects and diagnostics remain online.

- **Prove the Durable Object fix:** idle frontend polling produces zero relay request frames, state traffic occurs only when data changes, and Cloudflare invocations no longer scale with polling frequency.

- **Preserve every feature:** task history, live logs, tools, todos, diagnostics, queue state, pipelines, START, STOP, CANCEL, RESUME, DELETE, reload recovery, and optimistic reconciliation must continue working.

- **Iteration completion:** focused tests, typechecks, full suites, served interaction tests, relay-outage tests, restart tests, multi-client load tests, and before/after Cloudflare metrics must pass before the change is committed and pushed.
