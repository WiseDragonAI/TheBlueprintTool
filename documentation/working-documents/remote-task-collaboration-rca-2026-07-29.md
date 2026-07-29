## A. Repository Intent

1. Decision OS lets every replica accept causal card and thread contributions while task assignment selects exactly one execution node.
2. Markdown content converges through resource heads and is materialized on demand; mutable Codex process artifacts remain executor-local.
3. An open task thread must rehydrate from a scoped content event without requiring navigation or a page reload.

---

## B. Current Iteration Intent

1. Restore live cross-node task-thread hydration.
2. Admit Workstation-assigned execution from Mobile without requiring Mobile to hold Workstation run artifacts.
3. Preserve pasted-image note intent and expose the backend rejection classification through the existing retry path.

---

## C. Verified Findings

1. The responsive thread subscribes to `ledger-content-change`, but canonical card and thread writes publish `card-content-change`. Federated resource installation emitted only a global invalidation without the owning thread identity. The first incorrect hydration transition is therefore the missing scoped event between a replicated resource-head change and the open responsive thread.
2. `continueCardSkillRunController` inspected the requester node's JSONL, thread, and output-card files before calling `TaskExecutionRouter.route`. A Mobile request for a Workstation-assigned task therefore failed locally with `Run output card content file was not found` before assignment could select the executor.
3. `startThreadCodexProcessController` had the same ordering defect for card and thread materialization.
4. Pasted-image notes used a boolean mutation result and substituted `Backend did not confirm the image note`. Text notes already persist a retry receipt and preserve structured backend failures.
5. Task ownership, replica provenance, and execution assignment are separate authorities. The route's replica selector must not become execution authority, and note writes must remain causal multi-writer contributions.

---

## D. Over-Engineering Analysis

1. Replicating complete Codex run directories would duplicate mutable executor state, expand the convergence surface, and still fail to define which replica may resume a process. It does not address the incorrect pre-routing validation boundary.
2. Proxying execution from the selected replica URL would make browsing location determine execution behavior and contradict assignment-based admission.
3. Adding another polling loop, refresh timer, content manifest, receipt format, or image-specific retry store would duplicate mechanisms already present.
4. The structurally smallest correction is to resolve assignment before executor-local validation, emit the existing scoped content event from federated head installation, and reuse the existing pending-message receipt for image markdown.

---

## E. Bloat Register

1. Remove from the solution: bulk run-output replication. The executor already owns mutable process files and publishes durable execution state.
2. Remove from the solution: replica-selector execution proxying. Assignment already identifies the execution node.
3. Remove from the solution: a second thread refresh channel. `card-content-change` already carries the required project, ledger, card, and thread identity.
4. Remove from the solution: image-only persistence and retry state. The pending thread-message receipt already owns stable note identity, retry, reconciliation, and exact failure presentation.
5. Keep outside this iteration: generic attachment-note retry. The reported failure concerns pasted images, and expanding the change would add an unverified adjacent behavior.

---

## F. Selected Remediation

1. Add a read-only destination resolution boundary to the task execution router and use it before requester-local materialization in thread starts and continuations. The assigned executor retains all validation and spawn authority.
2. Translate changed federated Markdown resource heads into exact `card-content-change` events on the hosted project's stream without recording a new contribution or republishing content.
3. Subscribe the responsive thread to that scoped event and retain the existing scope checks before rehydration.
4. Persist pasted-image markdown through `persistPendingThreadMessage`, then reconcile it through `commitPendingThreadMessage`.

---

## G. Operator Decision Summary

1. The credible path is assignment-first execution routing plus scoped content invalidation and existing receipt reuse.
2. This path advances remote collaboration without adding a second ownership model, broad artifact replication, a polling layer, or image-specific state.
3. Canary validation must prove live Mobile hydration, remotely assigned continuation admission, successful image-note convergence, and preserved retry feedback for a rejected image note.
