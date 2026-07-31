# Temporary Worktree Canary

## A. Purpose And Boundary

1. Use this procedure to verify code served directly from one temporary Decision OS feature worktree before integration into `dev`.
2. The feature worktree owns only application source. A temporary scratch workspace owns the served `.decision-os` state so startup discovery, migrations, prompt installation, incidents, and test writes cannot modify source fixtures in the feature worktree.
3. Never use the existing `dev` worktree as the temporary canary source. That worktree already owns the persistent MultiTerm server on port `50151`, so serving it again does not prove feature-worktree isolation.
4. The dedicated feature worktree must contain the change under verification. For a topology smoke test, add one unmistakable rendered text marker to a persistent application surface, commit it on the feature branch, and verify that exact marker through the temporary canary before removing it.
5. The canary is a bounded test process. Do not register it in MultiTerm, enable automatic restart, attach it to a federation relay, reuse ports `50150` through `50152`, or leave it running after verification.
6. Federation behavior is outside this canary boundary. Verify federation with the isolated integration fixture, then use the persistent integrated-dev canary for final served evidence after merge into `dev`.

---

## B. Source Worktree Admission

1. Create the feature worktree from the current local `dev` branch according to the repository worktree policy, enter it, and initialize its Decision OS submodule:

   ```bash
   cd /home/jbb/dev/EditorBP/decision-os/.worktrees/<feature-worktree>
   git -c protocol.file.allow=always submodule update --init -- .decision-os
   CANARY_SOURCE=$(pwd)
   ```

2. Require the launcher, state baseline, and worktree-owned backend dependencies:

   ```bash
   test -x "$CANARY_SOURCE/bin/decision-os-server.mjs"
   test -f "$CANARY_SOURCE/.decision-os/state.json"
   if ! test -f "$CANARY_SOURCE/backend/node_modules/tsx/dist/loader.mjs"; then
     npm ci --prefix "$CANARY_SOURCE/backend"
   fi
   ```

3. Record the exact source identity and Decision OS state baseline:

   ```bash
   CANARY_SOURCE_SHA=$(git -C "$CANARY_SOURCE" rev-parse HEAD)
   CANARY_STATE_SHA=$(git -C "$CANARY_SOURCE" rev-parse HEAD:.decision-os)
   CANARY_STATE_URL=$(git -C "$CANARY_SOURCE" config -f .gitmodules --get submodule..decision-os.url)
   test -n "$CANARY_STATE_URL"
   git -C "$CANARY_SOURCE" status --short --branch
   ```

---

## C. Create The Isolated Runtime

1. Create one exact temporary root and a scratch parent repository:

   ```bash
   CANARY_RUNTIME=$(mktemp -d /tmp/decision-os-worktree-canary.XXXXXX)
   CANARY_WORKSPACE="$CANARY_RUNTIME/workspace"
   CANARY_LOG="$CANARY_RUNTIME/server.log"
   mkdir "$CANARY_WORKSPACE"
   git -C "$CANARY_WORKSPACE" init -b canary
   git -C "$CANARY_WORKSPACE" config user.name 'Decision OS Canary'
   git -C "$CANARY_WORKSPACE" config user.email 'decision-os-canary@localhost'
   git -C "$CANARY_WORKSPACE" commit --allow-empty \
     -m 'Initialize temporary canary workspace' \
     -m 'WHAT: Create an isolated parent repository for bounded canary state.' \
     -m 'WHY: Served runtime writes must remain outside the feature source worktree.'
   ```

2. Add a real `.decision-os` submodule from the source worktree's configured child repository, then pin it to the source worktree's recorded gitlink:

   ```bash
   git -C "$CANARY_WORKSPACE" -c protocol.file.allow=always \
     submodule add "$CANARY_STATE_URL" .decision-os
   git -C "$CANARY_WORKSPACE/.decision-os" switch --detach "$CANARY_STATE_SHA"
   git -C "$CANARY_WORKSPACE" add .gitmodules .decision-os
   git -C "$CANARY_WORKSPACE" commit \
     -m 'Pin temporary canary Decision OS state' \
     -m 'WHAT: Record the feature source baseline as the scratch workspace gitlink.' \
     -m 'WHY: The canary must start from the exact state admitted by the feature worktree.'
   ```

3. Reject federation configuration. The scratch workspace must not contain ignored settings with federation authority:

   ```bash
   if test -f "$CANARY_WORKSPACE/.decision-os/.settings.json" && \
      rg -n '"federation(RelayUrl|Id|NodeId|NodeCredential)"' \
        "$CANARY_WORKSPACE/.decision-os/.settings.json"; then
     printf 'Temporary canary settings contain federation configuration.\n' >&2
     exit 1
   fi
   ```

4. Allocate and verify a free dynamic loopback port:

   ```bash
   CANARY_PORT=$(python3 - <<'PY'
   import socket
   listener = socket.socket()
   listener.bind(('127.0.0.1', 0))
   print(listener.getsockname()[1])
   listener.close()
   PY
   )
   test "$CANARY_PORT" != 50150
   test "$CANARY_PORT" != 50151
   test "$CANARY_PORT" != 50152
   if ss -ltn "sport = :$CANARY_PORT" | tail -n +2 | rg -q .; then
     printf 'Selected canary port is already occupied: %s\n' "$CANARY_PORT" >&2
     exit 1
   fi
   ```

---

## D. Launch And Prove Readiness

1. Define bounded cleanup before launch so errors and interrupts cannot leave the canary running:

   ```bash
   CANARY_PID=''
   cleanup_canary() {
     if test -n "$CANARY_PID" && kill -0 "$CANARY_PID" 2>/dev/null; then
       CANARY_PGID=$(ps -o pgid= -p "$CANARY_PID" | tr -d ' ')
       if test "$CANARY_PGID" != "$CANARY_PID"; then
         printf 'Refusing cleanup: canary PID does not own its process group.\n' >&2
         return 1
       fi
       kill -TERM -- "-$CANARY_PGID"
       for _ in $(seq 1 20); do
         kill -0 "$CANARY_PID" 2>/dev/null || break
         sleep 0.25
       done
       kill -0 "$CANARY_PID" 2>/dev/null && kill -KILL -- "-$CANARY_PGID"
     fi
   }
   trap cleanup_canary EXIT INT TERM
   ```

2. Launch from the scratch workspace with the feature worktree's launcher:

   ```bash
   setsid sh -c 'cd "$1" && exec env PORT="$2" "$3" >>"$4" 2>&1' \
     sh "$CANARY_WORKSPACE" "$CANARY_PORT" \
     "$CANARY_SOURCE/bin/decision-os-server.mjs" "$CANARY_LOG" \
     </dev/null >/dev/null 2>&1 &
   CANARY_PID=$!
   ```

3. Poll bounded readiness for at most 30 seconds:

   ```bash
   CANARY_URL="http://127.0.0.1:$CANARY_PORT"
   CANARY_READY=0
   for _ in $(seq 1 60); do
     if curl -fsS --max-time 1 "$CANARY_URL/api/health" \
        >"$CANARY_RUNTIME/health.json" 2>/dev/null; then
       CANARY_READY=1
       break
     fi
     if ! kill -0 "$CANARY_PID" 2>/dev/null; then
       break
     fi
     sleep 0.5
   done
   if test "$CANARY_READY" != 1; then
     tail -n 200 "$CANARY_LOG" >&2
     exit 1
   fi
   ```

4. Prove readiness and source ownership:

   ```bash
   ps -o pid,ppid,pgid,lstart,args -p "$CANARY_PID"
   jq . "$CANARY_RUNTIME/health.json"
   curl -fsS -I "$CANARY_URL/"
   ps -ef | rg "$CANARY_SOURCE/(bin/decision-os-server.mjs|backend/src/server.ts)" | rg -v rg
   test "$(pwd -P)" = "$CANARY_SOURCE"
   ```

5. Run the focused HTTP or browser behavior required by the feature against `CANARY_URL`. Verify the change on a rendered application surface; an HTTP response containing markup that the application replaces during startup is not visual proof. Browser proof must follow `BROWSER_RUNBOOK.md` and must not control the operator's browser.

---

## E. Mandatory Cleanup

1. Stop the exact canary process group, then prove absence:

   ```bash
   cleanup_canary
   CANARY_PID=''
   if ss -ltn "sport = :$CANARY_PORT" | tail -n +2 | rg -q .; then
     printf 'Temporary canary port remains occupied: %s\n' "$CANARY_PORT" >&2
     exit 1
   fi
   if ps -ef | rg "$CANARY_SOURCE/(bin/decision-os-server.mjs|backend/src/server.ts)" | rg -v rg; then
     printf 'Temporary canary process remains alive.\n' >&2
     exit 1
   fi
   trap - EXIT INT TERM
   ```

2. Prove the source worktree remained unchanged by the served runtime:

   ```bash
   test "$(git -C "$CANARY_SOURCE" rev-parse HEAD)" = "$CANARY_SOURCE_SHA"
   test "$(git -C "$CANARY_SOURCE" rev-parse HEAD:.decision-os)" = "$CANARY_STATE_SHA"
   git -C "$CANARY_SOURCE" status --short --branch
   ```

3. The scratch workspace may contain canary-authored commits or runtime evidence. Preserve `CANARY_RUNTIME` when diagnosing a failure. After successful evidence review, remove only that exact path:

   ```bash
   printf 'Temporary canary evidence: %s\n' "$CANARY_RUNTIME"
   ```

4. Do not remove the feature worktree until its implementation is committed and integrated according to repository policy.

---

## F. Acceptance Evidence

1. Record the feature source worktree, exact `HEAD`, and recorded `.decision-os` gitlink.
2. Record the scratch workspace, dynamically allocated port, and log path.
3. Record successful `/api/health` and `/` responses plus the feature-specific rendered observation. For a topology smoke test, record the exact visible marker confirmed by the operator.
4. Record that the launcher and backend process paths belong to the feature worktree while process cwd belongs to the scratch workspace.
5. Record that no MultiTerm registration or federation configuration was created.
6. Record that ports `50150`, `50151`, and `50152` were not stopped or restarted.
7. Record that the temporary port and feature-owned server processes are absent after cleanup.
8. Record that the feature worktree source status and gitlink are unchanged by runtime activity.
9. Passing this procedure proves only the feature worktree. Final integration evidence still belongs to the persistent `dev` canary after the feature merges into `dev`.
