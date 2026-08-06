## A. Verified Phone Topology

1. **Platform:** Termux on Android arm64.
2. **Branch:** `dev`.
3. **Worktree:** `/data/data/com.termux/files/home/decision-os/.worktrees/dev`.
4. **Production application:** `http://127.0.0.1:50150/`, supervised by runit service `decision-os`.
5. **Canary application:** `http://127.0.0.1:50151/`, supervised by runit service `decision-os-canary`.
6. **Canary relay:** `http://127.0.0.1:50152/`, supervised by runit service `decision-os-relay-dev`.
7. **Canary federation identity:** `decision-os-canary-phone`.
8. **Canary node identity:** `phone-dev`, labeled `Mobile Canary`.
9. **Isolation:** production discovery skips `.worktrees`; production settings, relay credential, federation ID, process, logs, runtime incidents, and task-state files are not reused.
10. The phone topology was established and verified on `2026-07-29`. Resolve the current `origin/dev` SHA at every later update; do not treat the original SHA as durable admission evidence.

---

## B. Termux Runtime Selection

1. Termux uses `sv` and `svlogd`; it does not use the workstation MultiTerm registrations.
2. Pinned Wrangler `4.111.0` cannot run locally on Android arm64 because its `workerd` package has no Android binary. The Linux arm64 binary also cannot link against Android Bionic.
3. The phone therefore runs `federation-relay/src/termux-local-relay.ts` with Node, `ws`, and the same protocol, state join, bucket, flow-control, authentication, catalog, and health contracts as the source relay.
4. Phone relay state is durable and ignored under `federation-relay/.wrangler/state-termux/relay.json`.
5. The ignored `federation-relay/.dev.vars.termux` owns only the phone-dev administrator secret and exact dev release SHA.
6. This Node runtime is a local canary adapter. Production relay deployment remains exclusively owned by the Cloudflare delivery protocol.

---

## C. Branch And Dependency Bootstrap

1. Fetch and create the isolated worktree:

   ```bash
   cd /data/data/com.termux/files/home/decision-os
   git fetch origin main dev
   git worktree add .worktrees/dev -b dev origin/dev
   ```

2. When the worktree already exists, update it without touching production:

   ```bash
   git -C /data/data/com.termux/files/home/decision-os/.worktrees/dev fetch origin main dev
   git -C /data/data/com.termux/files/home/decision-os/.worktrees/dev merge --ff-only origin/main
   GIT_SSH_COMMAND='ssh -i /data/data/com.termux/files/home/.ssh/id_ed25519_github_phone -o IdentitiesOnly=yes' \
     git -C /data/data/com.termux/files/home/decision-os/.worktrees/dev push origin dev
   ```

3. Require `dev` to be clean, pushed, and descended from `origin/main`:

   ```bash
   git -C /data/data/com.termux/files/home/decision-os/.worktrees/dev status --short
   git -C /data/data/com.termux/files/home/decision-os/.worktrees/dev rev-parse HEAD
   git -C /data/data/com.termux/files/home/decision-os/.worktrees/dev rev-parse origin/dev
   git -C /data/data/com.termux/files/home/decision-os/.worktrees/dev merge-base --is-ancestor origin/main HEAD
   ```

4. Install worktree-local dependencies:

   ```bash
   npm ci --prefix /data/data/com.termux/files/home/decision-os/.worktrees/dev/backend
   npm ci --prefix /data/data/com.termux/files/home/decision-os/.worktrees/dev/frontend
   npm ci --prefix /data/data/com.termux/files/home/decision-os/.worktrees/dev/federation-relay
   ```

5. `backend` declares optional `@img/sharp-wasm32` for Android. Verify Sharp before registering the application:

   ```bash
   cd /data/data/com.termux/files/home/decision-os/.worktrees/dev/backend
   node -e "import('sharp').then(() => console.log('sharp ok'))"
   ```

---

## D. Dev Relay Secret And Runit Registration

1. Create the ignored relay environment without printing the administrator secret:

   ```bash
   cd /data/data/com.termux/files/home/decision-os/.worktrees/dev
   node -e "const fs=require('fs'),c=require('crypto'),cp=require('child_process'),p=require('path');const root=process.cwd();const sha=cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();const file=p.join(root,'federation-relay','.dev.vars.termux');fs.writeFileSync(file,'ADMIN_SECRET='+c.randomBytes(32).toString('hex')+'\nDECISION_OS_RELEASE_SHA='+sha+'\n',{mode:0o600});fs.chmodSync(file,0o600)"
   ```

2. Create these directories:

   ```bash
   mkdir -p \
     /data/data/com.termux/files/usr/var/service/decision-os-relay-dev/log \
     /data/data/com.termux/files/usr/var/log/decision-os-relay-dev
   ```

3. Install `/data/data/com.termux/files/usr/var/service/decision-os-relay-dev/run`:

   ```sh
   #!/data/data/com.termux/files/usr/bin/sh
   exec 2>&1
   dev_root=/data/data/com.termux/files/home/decision-os/.worktrees/dev
   set -a
   . "$dev_root/federation-relay/.dev.vars.termux"
   set +a
   cd "$dev_root/federation-relay"
   export HOST=127.0.0.1
   export PORT=50152
   export DECISION_OS_RELAY_STATE_FILE="$dev_root/federation-relay/.wrangler/state-termux/relay.json"
   exec /data/data/com.termux/files/usr/bin/node \
     --import "$dev_root/backend/node_modules/tsx/dist/esm/index.mjs" \
     "$dev_root/federation-relay/src/termux-local-relay.ts"
   ```

4. Install `/data/data/com.termux/files/usr/var/service/decision-os-relay-dev/log/run`:

   ```sh
   #!/data/data/com.termux/files/usr/bin/sh
   exec /data/data/com.termux/files/usr/bin/svlogd -tt \
     /data/data/com.termux/files/usr/var/log/decision-os-relay-dev
   ```

5. Mark both scripts executable and start the relay:

   ```bash
   chmod 700 \
     /data/data/com.termux/files/usr/var/service/decision-os-relay-dev/run \
     /data/data/com.termux/files/usr/var/service/decision-os-relay-dev/log/run
   sv up decision-os-relay-dev
   sv status decision-os-relay-dev
   curl -sS http://127.0.0.1:50152/health
   ```

---

## E. Canary Credential And Settings

1. Provision `phone-dev` through the local administrator boundary and write the credential directly into ignored mode-`0600` settings:

   ```bash
   cd /data/data/com.termux/files/home/decision-os
   node -e "const fs=require('fs'),c=require('crypto'),p=require('path');(async()=>{const root=p.resolve('.worktrees/dev');const vars=Object.fromEntries(fs.readFileSync(p.join(root,'federation-relay','.dev.vars.termux'),'utf8').trim().split(/\n/).map(line=>{const at=line.indexOf('=');return [line.slice(0,at),line.slice(at+1)]}));const response=await fetch('http://127.0.0.1:50152/admin/federations/decision-os-canary-phone/nodes/phone-dev',{method:'POST',headers:{authorization:'Bearer '+vars.ADMIN_SECRET}});const body=await response.json();if(response.status!==201||!body.credential)throw new Error('phone canary provisioning failed');const settings={decisionOsFrontendRoot:p.join(root,'frontend'),federationRelayUrl:'http://127.0.0.1:50152',federationId:'decision-os-canary-phone',federationNodeId:'phone-dev',federationNodeCredential:body.credential,federationNodeLabel:'Mobile Canary',maxConcurrentCodexProcesses:1,deliveryRepositoryRoot:process.cwd(),deliveryReleaseRoot:'/data/data/com.termux/files/home/.decision-os-canary/releases',deliveryCandidateCurrentPointer:'/data/data/com.termux/files/home/.decision-os-canary/current',deliveryDecisionOsRoot:p.join(root,'.decision-os'),deliveryNodeId:'phone-dev',deliveryLocalDispatchToken:c.randomBytes(32).toString('base64url'),projectSyncGitSshIdentityFile:'/data/data/com.termux/files/home/.ssh/id_ed25519_github_phone'};const file=p.join(root,'.decision-os','.settings.json');fs.writeFileSync(file,JSON.stringify(settings,null,2)+'\n',{mode:0o600});fs.chmodSync(file,0o600)})().catch(error=>{console.error(error.message);process.exit(1)})"
   ```

2. Do not copy production `federationId`, `federationNodeCredential`, `federationRelayUrl`, and `deliveryLocalDispatchToken`.
3. Re-provisioning replaces only the ignored canary credential. It does not mutate production federation state.

---

## F. Canary Application Runit Registration

1. Create these directories:

   ```bash
   mkdir -p \
     /data/data/com.termux/files/usr/var/service/decision-os-canary/log \
     /data/data/com.termux/files/usr/var/log/decision-os-canary
   ```

2. Install `/data/data/com.termux/files/usr/var/service/decision-os-canary/run`:

   ```sh
   #!/data/data/com.termux/files/usr/bin/sh
   exec 2>&1
   cd /data/data/com.termux/files/home/decision-os/.worktrees/dev
   export HOST=127.0.0.1
   export PORT=50151
   exec /data/data/com.termux/files/home/decision-os/.worktrees/dev/bin/decision-os-server.mjs
   ```

3. Install `/data/data/com.termux/files/usr/var/service/decision-os-canary/log/run`:

   ```sh
   #!/data/data/com.termux/files/usr/bin/sh
   exec /data/data/com.termux/files/usr/bin/svlogd -tt \
     /data/data/com.termux/files/usr/var/log/decision-os-canary
   ```

4. Mark both scripts executable and start the canary:

   ```bash
   chmod 700 \
     /data/data/com.termux/files/usr/var/service/decision-os-canary/run \
     /data/data/com.termux/files/usr/var/service/decision-os-canary/log/run
   sv up decision-os-canary
   sv status decision-os-canary
   curl -sS http://127.0.0.1:50151/api/health
   ```

---

## G. Required Phone Proof

1. Capture all three health surfaces:

   ```bash
   curl -sS http://127.0.0.1:50150/api/health
   curl -sS http://127.0.0.1:50151/api/health
   curl -sS http://127.0.0.1:50152/health
   ```

2. Require both dev services to be supervised:

   ```bash
   sv status decision-os
   sv status decision-os-canary
   sv status decision-os-relay-dev
   ```

3. Require the canary catalog to identify only local `phone-dev` ownership:

   ```bash
   curl -sS http://127.0.0.1:50151/api/federation/nodes
   ```

4. Require canary relay convergence, zero runtime dirt, zero pending delivery IDs, and zero content queue depth:

   ```bash
   curl -sS http://127.0.0.1:50151/api/federation/replication-status
   ```

5. Require production discovery to omit `.worktrees/dev`:

   ```bash
   curl -sS http://127.0.0.1:50150/decision-os/projects
   ```

6. Restart only the two dev services and repeat the proof to verify durable relay state and automatic process recovery:

   ```bash
   sv restart decision-os-relay-dev
   sv restart decision-os-canary
   ```

7. The initial mutable canary truthfully reports `releaseSha: ""`, `deliveryProtocol: 0`, and `activeReleasePointer: "unbootstrapped"`. It must not claim candidate admission merely because the service and federation proof pass.

---

## H. Exact-SHA Update Cycle

1. Commit and push `dev` before claiming an exact release.
2. Stop only `decision-os-canary` while preparing candidate identity:

   ```bash
   sv down decision-os-canary
   ```

3. Refresh `DECISION_OS_RELEASE_SHA` in `.dev.vars.termux` to the exact pushed `origin/dev` SHA without changing `ADMIN_SECRET`.
4. Require a clean worktree, `HEAD == origin/dev`, and `origin/main` ancestry.
5. Run the source-owned candidate command from the dev worktree:

   ```bash
   cd /data/data/com.termux/files/home/decision-os/.worktrees/dev
   node bin/decision-os-delivery.mjs candidate \
     --release-tag rel-X.Y.Z \
     --json
   ```

6. Candidate preparation may retain the exact ignored release marker and current pointer before later admission evidence rejects an unbootstrapped production topology. That rejection does not authorize promotion.
7. Restart both dev services and require their health responses to name the same exact SHA:

   ```bash
   sv restart decision-os-relay-dev
   sv up decision-os-canary
   ```

8. A source change invalidates the exact-SHA proof. Repeat the complete commit, push, identity, restart, and health sequence.

---

## I. Logs And Recovery

1. Application log:

   ```text
   /data/data/com.termux/files/usr/var/log/decision-os-canary/current
   ```

2. Relay log:

   ```text
   /data/data/com.termux/files/usr/var/log/decision-os-relay-dev/current
   ```

3. Canary incidents:

   ```text
   /data/data/com.termux/files/home/decision-os/.worktrees/dev/.decision-os/runtime-incidents.json
   ```

4. Relay state:

   ```text
   /data/data/com.termux/files/home/decision-os/.worktrees/dev/federation-relay/.wrangler/state-termux/relay.json
   ```

5. A corrupt relay-state file remains byte-identical and prevents relay startup. Preserve it, inspect the relay log, and restore a recorded valid dev-only copy before restarting.
6. A missing Sharp WASM package causes the launcher emergency health surface to report a paused child. Re-run `npm ci --prefix backend`, verify `import('sharp')`, then restart only `decision-os-canary`.
7. A replaced node credential requires reprovisioning and a canary application restart. It never requires a production restart.

---

## J. Dev-Only Cleanup

1. Stop the canary application and relay:

   ```bash
   sv down decision-os-canary
   sv down decision-os-relay-dev
   ```

2. Remove the two runit service directories only after their status is down.
3. Preserve relay state and incident evidence when either is referenced by a verification receipt.
4. Remove `.worktrees/dev` only after both dev services are absent.
5. Phone canary cleanup never stops production `50150`, changes production settings, deletes production state, and substitutes for production delivery rollback.
