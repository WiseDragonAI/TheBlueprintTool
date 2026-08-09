## A. Repository Intent

Decision OS epoch-4 federation must converge causal task state without discarding invalid durable evidence. A terminal same-dot different-value collision pauses only its project, remains inspectable across restart, and resumes only through an explicit causally dominating recovery mutation.

---

## B. Current Iteration Intent

Correct the production MOH failure where one relay-to-node `task_current_dot_collision` aborts an entire repair group, produces no correlated terminal result, becomes a generic `federation_state_no_progress` timeout, and repeats after incident reset and restart.

---

## C. Findings

1. `TaskCurrentStateStore.mergeRepairGroup()` flattens the complete repair window into one merge. One colliding entity rejects healthy independent entries in that window.
2. The receiver emits no ACK after the collision. The relay retains the delivery, the node renews no durable-progress deadline, and the project pauses after the finite timeout.
3. Repair preview, journal durability, and installation do not share one transition lock with local mutation and activation. A concurrent mutation can invalidate the preview after the remote journal is durable.
4. Epoch-4 ACKs have no structured terminal rejection contract. Empty queues after timeout therefore cannot distinguish convergence from a retained poisoned delivery.
5. Restart recovery retains the generic incident but not complete collision evidence, both entity hashes, both entity encodings, and the exact rejected delivery authority.
6. A valid successor can resolve the collision without migration: a fresh deterministic local mutation carries a new dot and a context clock covering the collided dot. Normal register join then removes the covered historical candidates.
7. Recovery must be idempotent across crashes. The existing mutation path selects a counter and random batch ID at execution time and is insufficient as an operator recovery transaction without a durable operation receipt.
8. The copied-main blank-node canary did not contain persisted state on both sides of the same causal dot. It proved transport and empty-node convergence but could not exercise this collision class.

---

## D. Remediation Paths

1. Add a shared additive epoch-4 collision result containing the entity key, submitted hash, receiver hash, stable code, and canonically sorted path/dot coordinates.
2. Add one project-store transition serializer owning local mutation, activation, ordinary merge, repair preflight, journal durability, and installation.
3. Apply a relay repair window per entity under that serializer: prepare all entries, journal healthy accepted entries as one bounded group, persist complete rejected evidence before ACK, install accepted entries, and return exact accepted plus rejected coverage.
4. Require the relay to validate that accepted and rejected results form an exact disjoint cover of the submitted delivery. Persist terminal blocked entries before releasing delivery credit; never automatically resend the blocked submitted hash.
5. Persist node collision evidence containing both complete entities, hashes, roots, attempt and delivery identities, and collision coordinates. Preserve invalid evidence byte-identically and pause only the project.
6. Add one deterministic recovery mutation and its receipt to the same atomic journal document. Validate the current entities and referenced artifact files before committing the successor; restart replays the mutation and receipt together.
7. Publish the successor through the normal epoch-4 dirty path. Keep the project paused until correlated acceptance, exact equal roots, store close/reopen, and hash equality succeed.
8. Prove mixed batches, lost ACK reconstruction, reconnect, node and relay restart, deterministic recovery replay, stale evidence rejection, artifact validation, exact convergence, and zero poisoned relay-to-node delivery replay.

---

## E. Operator Decision Summary

The implementation remains epoch-4 compatible and preserves every existing frame type. It adds structured result fields, durable terminal evidence, and explicit recovery for the production MOH relay-to-node collision. Node-to-relay collision recovery is not claimed; the rejected hash is contained across reconnect and restart. The patch does not reset state, delete relay authority, silently select a value, enlarge transport windows, or retry the terminal relay-to-node entity.
