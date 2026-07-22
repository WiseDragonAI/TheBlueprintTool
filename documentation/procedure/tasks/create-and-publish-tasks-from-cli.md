# Create And Publish Tasks From The CLI

## A. Purpose And Authority

1. Use this runbook to create a task or master-task graph from a shell against a running Decision OS epoch-3 project.
2. The project-scoped command endpoint `PATCH /p/:projectId/decision-os/tasks` owns structural task mutations.
3. `.decision-os/cards/tasks/*.md` and `.decision-os/threads/tasks/*.md` own versionable bodies.
4. `.decision-os/task-state/<projectId>/current/` and `objects/` are runtime-owned causal state. Never edit or stage them directly.
5. `.decision-os/tasks.json` is a retired aggregate for epoch-3 Tasks. Never use `ledger-cli` or direct JSON editing to create an epoch-3 task.

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
const zoneX = Number(process.env.TASK_ZONE_X);
const zoneY = Number(process.env.TASK_ZONE_Y);
if (!serverUrl || !projectId || !Number.isFinite(zoneX) || !Number.isFinite(zoneY)) {
  throw new Error('TASK_SERVER_URL, TASK_PROJECT_ID, TASK_ZONE_X, and TASK_ZONE_Y are required.');
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

2. Verify the master card is readable from the canonical projection.

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

## F. Commit The Versioned Task Content

1. Inspect the exact files created by the response and the worktree status.
2. Do not stage `.decision-os/task-state/**`, `.decision-os/tasks.json`, voice uploads, run artifacts, caches, settings, or unrelated changes.
3. Do not use `git add .`.
4. Stage every intended master/subtask card Markdown and thread Markdown explicitly using the printed paths.

```bash
cd "$TASK_PROJECT_ROOT"
git status --short
git add -- \
  .decision-os/cards/tasks/card-replace-with-master-id.md \
  .decision-os/threads/tasks/thread-card-replace-with-master-id.md \
  .decision-os/cards/tasks/card-replace-with-subtask-id.md \
  .decision-os/threads/tasks/thread-card-replace-with-subtask-id.md
git diff --cached --check
git diff --cached --stat
```

5. Create a focused commit with the repository-required message body.

```bash
git commit \
  -m 'Add replace-with-task-name master task' \
  -m 'WHAT: Add the master-task documents, activated thread, and declared implementation subtasks.' \
  -m 'WHY: Record the verified operator request and preserve its executable task breakdown.'
git show -s --format=%B HEAD
```

---

## G. Push And Verify

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

## H. Failure And Recovery

1. **Creation rejected:** preserve the response body, correct the payload, and retry only when no master ID was created.
2. **Creation succeeded and activation failed:** reuse the printed master ID and submit only `append-note`; repeating creation produces a duplicate graph.
3. **Held marker remains after `append-note`:** stop, preserve the marker and response, and diagnose task content contribution handling. Do not edit the marker directly.
4. **Replication does not converge:** preserve replication diagnostics and pending delivery IDs. Do not restart the server or rewrite causal state as a recovery action.
5. **Commit includes unrelated files:** unstage only the agent-added paths, rebuild the explicit file list, and preserve operator-staged hunks.
6. **Push fails:** keep the verified local commit unchanged, report the SSH or remote error, and retry the same commit after credentials or connectivity recover.

---

## I. Primary Evidence

1. `backend/src/business/server/helper/create-http-server.ts`
2. `backend/src/business/ledger/helper/apply-ledger-mutation.ts`
3. `backend/src/business/task-state/helper/task-mutation-command.ts`
4. `backend/src/business/task-state/helper/project-task-state.ts`
5. `backend/src/business/task-state/helper/task-local-publication-state.ts`
6. `backend/test/server/master-task-create.integration.test.ts`
7. `backend/test/unit/task-state/project-task-state.test.ts`
8. `documentation/documentation/architecture/epoch-3-task-state-and-federation.md`
