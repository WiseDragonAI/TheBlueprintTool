# Create And Publish Tasks From The CLI

## A. Purpose And Authority

1. Use this runbook to create a task or master-task graph from a shell against a running Decision OS epoch-4 project.
2. The project-scoped command endpoint `PATCH /p/:projectId/decision-os/tasks` owns structural task mutations.
3. `.decision-os/cards/tasks/*.md` and `.decision-os/threads/tasks/*.md` own versionable bodies.
4. `.decision-os/task-state/<projectId>/current/` and `objects/` are runtime-owned causal state. Never edit or stage them directly.
5. `.decision-os/tasks.json` is a retired aggregate for epoch-4 Tasks. Never use `ledger-cli` or direct JSON editing to create an epoch-4 task.

---

## B. Prerequisites

1. Read the target project's `AGENTS.md` and every nearer instruction file.
2. Confirm that the Decision OS server is already running. Do not restart it unless the operator explicitly requested a restart.
3. Confirm the project root, project ID, server origin, target branch, and worktree status.
4. Stop if the required files contain staged operator changes.

```bash
export TASK_PROJECT_ROOT=/absolute/path/to/project
export TASK_SERVER_URL=http://127.0.0.1:50150
export TASK_PROJECT_ID=replace-with-project-id
export TASK_ASSIGNED_NODE_ID=workstation

cd "$TASK_PROJECT_ROOT"
curl -sS -I "$TASK_SERVER_URL/"
test "$(node -e 'const fs=require("node:fs");process.stdout.write(String(JSON.parse(fs.readFileSync(".decision-os/project.json","utf8")).id||""))')" = "$TASK_PROJECT_ID"
git status --short
git branch --show-current
git remote -v
```

5. Read the current canvas before choosing geometry. New zones must not cover an existing task zone.

```bash
curl -sS "$TASK_SERVER_URL/p/$TASK_PROJECT_ID/api/ledgers/tasks/canvas"
```

---

## C. Create And Activate A Master-Task Graph

1. Set non-overlapping zone geometry.
2. Edit the title, master body, and `subtaskInputs` in the following command.
3. Keep every durable task document in English.
4. Run the command once. It creates the graph and immediately appends the truthful agent note that activates publication.

```bash
export TASK_ZONE_X=0
export TASK_ZONE_Y=4000

node <<'NODE'
const { randomUUID } = require('node:crypto');

const serverUrl = String(process.env.TASK_SERVER_URL || '').replace(/\/$/, '');
const projectId = String(process.env.TASK_PROJECT_ID || '');
const assignedNodeId = String(process.env.TASK_ASSIGNED_NODE_ID || '');
const zoneX = Number(process.env.TASK_ZONE_X);
const zoneY = Number(process.env.TASK_ZONE_Y);
if (!serverUrl || !projectId || !/^[a-zA-Z0-9_-]+$/.test(assignedNodeId) || !Number.isFinite(zoneX) || !Number.isFinite(zoneY)) {
  throw new Error('TASK_SERVER_URL, TASK_PROJECT_ID, TASK_ASSIGNED_NODE_ID, TASK_ZONE_X, and TASK_ZONE_Y are required.');
}

const title = 'Replace with the master-task title';
const masterBody = `## A. Executive Summary

Replace with the verified objective, incident, scope, and required outcome.

---

## B. Acceptance Criteria

1. Replace with one concrete, testable result.
`;
const subtaskInputs = [
  { title: 'Replace with subtask one', body: 'Replace with its concrete implementation boundary.' },
  { title: 'Replace with subtask two', body: 'Replace with its concrete verification boundary.' },
];

const masterId = `card-${randomUUID()}`;
const zoneId = `zone-${randomUUID()}`;
const subtasks = subtaskInputs.map((input, index) => {
  const id = `card-${randomUUID()}`;
  const column = index % 2;
  const row = Math.floor(index / 2);
  return {
    id,
    title: input.title,
    cardType: 'note',
    domainId: 'tasks',
    status: 'todo',
    labels: ['subtask'],
    x: zoneX + 450 + column * 380,
    y: zoneY + 60 + row * 410,
    w: 340,
    h: 380,
    comment: {
      what: input.body,
      contentFile: `.decision-os/cards/tasks/${id}.md`,
    },
    facts: [],
    fields: [],
  };
});
const zoneHeight = Math.max(900, 120 + Math.ceil(subtasks.length / 2) * 410);
const endpoint = `${serverUrl}/p/${encodeURIComponent(projectId)}/decision-os/tasks`;
const request = async (payload) => {
  const response = await fetch(endpoint, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`${response.status} ${JSON.stringify(result)}`);
  return result;
};

(async () => {
  const creation = await request({
    action: 'create-master-task',
    assignedNodeId,
    annotation: {
      id: zoneId,
      x: zoneX,
      y: zoneY,
      width: 1200,
      height: zoneHeight,
      color: '#dc557d',
      label: title,
      comments: [],
    },
    card: {
      id: masterId,
      title,
      cardType: 'note',
      domainId: 'tasks',
      status: 'todo',
      labels: ['master-task'],
      x: zoneX + 60,
      y: zoneY + 60,
      w: 360,
      h: 240,
      comment: {
        what: masterBody,
        contentFile: `.decision-os/cards/tasks/${masterId}.md`,
      },
      facts: [],
      fields: [],
    },
    cards: subtasks,
    relationships: subtasks.map((subtask, position) => ({
      id: `rel-${randomUUID()}`,
      from: masterId,
      to: subtask.id,
      label: 'subtask',
      position,
    })),
  });

  await request({
    action: 'append-note',
    note: {
      id: `note-agent-${randomUUID()}`,
      threadId: `thread-${masterId}`,
      role: 'agent',
      body: `Master task created from the CLI with ${subtasks.length} implementation subtasks.`,
    },
  });

  process.stdout.write(`${JSON.stringify({
    projectId,
    assignedNodeId,
    zoneId,
    masterId,
    subtaskIds: subtasks.map((subtask) => subtask.id),
    createdFiles: creation.createdFiles,
  }, null, 2)}\n`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
NODE
```

5. Preserve the printed IDs. They are required for verification and selective staging.
6. If creation succeeds but activation fails, do not repeat `create-master-task`. Submit only the `append-note` mutation for the printed `masterId`.

---

## D. Why Activation Is Mandatory

1. `create-card`, `create-task-intake`, and `create-master-task` write their structural entities with `replication: held` and an activation task ID.
2. Held entities are visible in the creating replica's local projection but excluded from replicated roots.
3. The `append-note` mutation records a thread content contribution and activates the complete held graph atomically.
4. A successful creation response without activation proves local creation only; it does not prove synchronized publication.

---

## E. Verify Local Projection And Publication

1. Export the printed master ID.

```bash
export TASK_MASTER_ID=card-replace-with-printed-id
```

2. Verify the master card is readable from the canonical projection and contains `assignment.nodeId = TASK_ASSIGNED_NODE_ID`.

```bash
curl -sS "$TASK_SERVER_URL/p/$TASK_PROJECT_ID/api/ledgers/tasks/cards/$TASK_MASTER_ID"
```

3. Verify that activation removed the node-local held marker.

```bash
test ! -e "$TASK_PROJECT_ROOT/.decision-os/task-state/$TASK_PROJECT_ID/local/held/$TASK_MASTER_ID.json"
```

4. Inspect replication diagnostics. The project row must converge to the local root with no pending delivery for the created entities before reporting synchronized state.

```bash
curl -sS "$TASK_SERVER_URL/api/federation/replication-status"
```

5. From another connected node, open the canonical card route and verify the master card, zone, ordered subtask relationships, thread note, and hydrated body.

---

## F. Add And Author A Subtask By Master ID

1. Create one subtask without supplying project, ledger, geometry, relationship, card, or Markdown-file inputs.

```bash
ledger-cli subtask-create \
  --master-card-id "$TASK_MASTER_ID" \
  --title "05 - Implementation: Deltas"
```

2. The command discovers the local project and `tasks` ledger from the master card ID, atomically creates the card plus canonical `subtask` relationship, and prints the absolute path of the new blank Markdown document.
3. Edit the printed document directly. `subtask-create` rejects `--markdown-file`; it never imports caller-authored Markdown during creation.
4. The scoped `create-subtask` mutation is active immediately because the existing published master owns its activation boundary.

---

## G. Commit The Master-Task Graph Markdown

1. After editing the new document, commit the master card and every relationship-backed subtask card by master ID.

```bash
ledger-cli master-task-commit \
  --master-card-id "$TASK_MASTER_ID"
```

2. The command rediscovers the owning project and `tasks` ledger, then the server reads the authoritative task projection and commits exactly the graph's versioned card Markdown files.
3. The focused authored-file transaction rejects any graph file that is already staged and preserves unrelated staged bytes.
4. Successful JSON output includes the project ID, ledger ID, master card ID, exact Git commit, and committed file inventory.
5. Do not stage `.decision-os/task-state/**`, `.decision-os/tasks.json`, voice uploads, run artifacts, caches, settings, or unrelated changes.

---

## H. Push And Verify

1. Push the current branch with the required Wise SSH identity.

```bash
export TASK_BRANCH="$(git branch --show-current)"
GIT_SSH_COMMAND='ssh -i ~/.ssh/id_jb_wise -o IdentitiesOnly=yes' git push origin "$TASK_BRANCH"
```

2. Verify that `origin/<branch>` resolves to the new commit.

```bash
test "$(git rev-parse HEAD)" = "$(git rev-parse "origin/$TASK_BRANCH")"
git status --short
```

3. Report the master-task URL, master ID, zone ID, subtask IDs, activation verification, commit hash, pushed branch, and any unrelated worktree changes left untouched.

---

## I. Failure And Recovery

1. **Creation rejected:** preserve the response body, correct the payload, and retry only when no master ID was created.
2. **Creation succeeded and activation failed:** reuse the printed master ID and submit only `append-note`; repeating creation produces a duplicate graph.
3. **Held marker remains after `append-note`:** stop, preserve the marker and response, and diagnose task content contribution handling. Do not edit the marker directly.
4. **Replication does not converge:** preserve replication diagnostics and pending delivery IDs. Do not restart the server or rewrite causal state as a recovery action.
5. **Graph file is staged:** preserve the staged hunk and stop. `master-task-commit` returns `authored_owner_staged` without modifying it.
6. **Graph is incomplete:** preserve the dangling relationship evidence and repair structural task state through the scoped API before retrying the commit.
7. **Push fails:** keep the verified local commit unchanged, report the SSH or remote error, and retry the same commit after credentials or connectivity recover.

---

## J. Primary Evidence

1. `backend/src/business/server/application/create-decision-os-server.ts`
2. `backend/src/business/ledger/helper/apply-ledger-mutation.ts`
3. `backend/src/business/task-state/helper/task-mutation-command.ts`
4. `backend/src/business/task-state/helper/project-task-state.ts`
5. `backend/src/business/task-state/helper/task-local-publication-state.ts`
6. `backend/src/business/task-state/http/task-content-routes.ts`
7. `ledger-cli/src/business/ledger/helper/create-subtask.ts`
8. `ledger-cli/src/business/ledger/helper/commit-master-task-graph.ts`
9. `backend/test/server/master-task-content-commit.integration.test.ts`
10. `ledger-cli/test/command/task-graph-authoring-command.test.ts`
11. `documentation/documentation/architecture/epoch-4-task-assignment-execution-and-content.md`
