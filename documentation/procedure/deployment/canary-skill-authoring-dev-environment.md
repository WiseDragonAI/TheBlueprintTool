## A. Current Canary

1. **Branch:** `dev`.
2. **Worktree:** `/home/jbb/dev/EditorBP/decision-os/.worktrees/dev`.
3. **Starting commit:** `9583acf820969a3ebdbdfac32d9cdfb77bcfa5d5`.
4. **Application:** `http://127.0.0.1:50151/`.
5. **Relay:** `http://127.0.0.1:50152/`.
6. **Isolation:** production project discovery skips `.worktrees`; production remains on `http://127.0.0.1:50150/`.

---

## B. MultiTerm Ownership

1. Register the local relay:

   ```bash
   /home/jbb/dev/multiterm/bin/multiwezterm-process register \
     --cwd /home/jbb/dev/EditorBP/decision-os/.worktrees/dev/federation-relay \
     --cmd './node_modules/.bin/wrangler dev --env dev --local --ip 127.0.0.1 --port 50152 --persist-to .wrangler/state-dev --log-level info --show-interactive-dev-session=false' \
     --port 50152 \
     --url http://127.0.0.1:50152/health \
     --name decision-os-relay-dev \
     --description 'Decision OS isolated local dev federation relay' \
     --auto-restart
   ```

2. Register the application:

   ```bash
   /home/jbb/dev/multiterm/bin/multiwezterm-process register \
     --cwd /home/jbb/dev/EditorBP/decision-os/.worktrees/dev \
     --cmd 'env PORT=50151 ./bin/decision-os-server.mjs' \
     --port 50151 \
     --url http://127.0.0.1:50151/ \
     --name decision-os-workstation-dev \
     --description 'Decision OS dev branch canary server with isolated project state and relay' \
     --auto-restart
   ```

3. MultiTerm owns restart behavior. Do not launch duplicate relay or application processes outside these registrations.

---

## C. Relay Environment

1. `federation-relay/wrangler.toml` declares `env.dev` with a distinct Worker name and environment-specific `FEDERATIONS` binding and migrations.
2. Local Durable Object state persists only under `federation-relay/.wrangler/state-dev`.
3. The ignored `federation-relay/.dev.vars.dev` owns the local `ADMIN_SECRET`.
4. The ignored worktree `.decision-os/.settings.json` owns the dev federation ID, node ID, node credential, node label, and relay URL.
5. Production relay URL, federation identity, node credential, Worker, and Durable Object state are not reused.
6. A public `workers.dev` deployment requires an operator-provided non-interactive `CLOUDFLARE_API_TOKEN`. The current proven canary uses Wrangler's local Worker and Durable Object runtime because no such credential is configured.

---

## D. Admission Proof

1. Require HTTP `200` from both application roots:

   ```bash
   curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:50150/
   curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:50151/
   ```

2. Require the dev relay health response to report:

   ```text
   stateProtocol: decision-os-task-state/4
   stateSchema: 4
   baselineEpoch: 4
   ```

3. Require the canary `/api/federation/replication-status` response to report:

   ```text
   ownerNodeId: workstation-dev
   converged: true
   runtimeDirty: []
   pendingDeliveryIds: []
   ```

4. Require production `/projects` to contain no `.worktrees/dev` project.
5. Require `multiwezterm-process list` to report both dev registrations as `enabled`, `running`, and `auto_restart`.

---

## E. Public Dev Deployment

1. Supply an account-scoped token through `CLOUDFLARE_API_TOKEN` without writing it to Git.
2. Validate the environment:

   ```bash
   npm --prefix federation-relay run typecheck
   federation-relay/node_modules/.bin/wrangler deploy --env dev --dry-run
   ```

3. Set the dev-only administrator secret:

   ```bash
   federation-relay/node_modules/.bin/wrangler secret put ADMIN_SECRET --env dev
   ```

4. Deploy:

   ```bash
   federation-relay/node_modules/.bin/wrangler deploy --env dev
   ```

5. Provision a new dev node credential against the deployed relay and replace only the ignored canary settings.
6. Verify public `/health`, manifest admission, and `/api/federation/replication-status` before replacing the local relay registration.

---

## F. Rollback and Cleanup

1. Stop and remove the canary application:

   ```bash
   /home/jbb/dev/multiterm/bin/multiwezterm-process unregister \
     --cwd /home/jbb/dev/EditorBP/decision-os/.worktrees/dev \
     --port 50151
   ```

2. Stop and remove the canary relay:

   ```bash
   /home/jbb/dev/multiterm/bin/multiwezterm-process unregister \
     --cwd /home/jbb/dev/EditorBP/decision-os/.worktrees/dev/federation-relay \
     --port 50152
   ```

3. Preserve `.wrangler/state-dev` when incident evidence is required. Remove it only after recording the verification result.
4. Remove the `dev` worktree only after both MultiTerm registrations are absent.
5. Canary cleanup must not stop, restart, reconfigure, or delete production state.
