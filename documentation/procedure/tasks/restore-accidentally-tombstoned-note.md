# Restore an Accidentally Tombstoned Epoch-4 Note

## A. Scope

1. Use this procedure only when evidence proves that a system defect tombstoned a note that the operator did not delete.
2. Restore the original `threadId` and `note.id`. Do not create a replacement note identity.
3. Never automatically resurrect an operator-deleted note.
4. Use the project-scoped command endpoint. Never edit `.decision-os/task-state/**`, causal shards, `deletedNoteIds`, or `.decision-os/tasks.json` directly.

---

## B. Evidence Gate

1. Read the authoritative epoch-4 task projection and confirm that the exact note ID is tombstoned in the target thread.
2. Inspect the thread Markdown and identify the exact `decision-os:note` marker, role, timestamp, and body when the sidecar still contains the note.
3. Establish the first incorrect system transition that created the tombstone. Preserve the related execution JSONL, stderr, migration report, and incident evidence.
4. Stop when operator deletion evidence exists. The command below is recovery for verified corruption, not deletion undo.

---

## C. Restore Existing Sidecar Content

1. Set the exact scoped values:

   ```bash
   export DECISION_OS_SERVER_URL='http://127.0.0.1:50150'
   export DECISION_OS_PROJECT_ID='<project-id>'
   export DECISION_OS_THREAD_ID='<thread-id>'
   export DECISION_OS_NOTE_ID='<note-id>'
   ```

2. Submit the exact restoration:

   ```bash
   node --input-type=module <<'NODE'
   const endpoint = `${process.env.DECISION_OS_SERVER_URL}/p/${encodeURIComponent(process.env.DECISION_OS_PROJECT_ID)}/decision-os/tasks`;
   const response = await fetch(endpoint, {
     method: 'PATCH',
     headers: { 'content-type': 'application/json' },
     body: JSON.stringify({
       action: 'restore-note',
       note: {
         id: process.env.DECISION_OS_NOTE_ID,
         threadId: process.env.DECISION_OS_THREAD_ID,
       },
     }),
   });
   const result = await response.json();
   if (!response.ok) throw new Error(`${response.status} ${JSON.stringify(result)}`);
   console.log(JSON.stringify(result, null, 2));
   NODE
   ```

3. The command reuses the sidecar note content, removes the exact causal tombstone, captures the resulting Markdown head, and persists the note entity plus resource head in one epoch-4 batch.

---

## D. Restore Missing Sidecar Content

1. When the sidecar has no matching note marker, include the verified original `body` and exact `role` in the `note` object.
2. A missing body returns `note_content_required`.
3. Use `role: "agent"` only for a verified direct agent reply. Every other restored role defaults to `operator`.
4. Preserve the original note ID. The recovery command creates a new timestamp only because the original sidecar timestamp is unavailable.

---

## E. Verification

1. Require HTTP `200` from the restoration command.
2. Read:

   ```text
   GET /p/<project-id>/api/ledgers/tasks/threads/<thread-id>
   ```

3. Require the exact note ID once, with the expected role and body.
4. Require the note ID to be absent from `deletedNoteIds[threadId]`.
5. Require the Markdown sidecar to contain the exact note marker and body once.
6. Require the current thread resource head hash and byte length to match the sidecar.
7. Build the agent prompt and require the restored legitimate note to be present while tombstoned notes and synthetic Codex artifact notes remain absent.
8. Re-run the project-wide tombstone audit and record every remaining tombstone with its verified cause.
