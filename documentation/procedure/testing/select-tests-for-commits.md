# Select Tests For Commits

## A. Purpose

1. `decision-os-test-impact` selects existing tests changed by a supplied commit series.
2. It also selects existing tests that transitively depend on changed code according to Graphify's static file relationships.
3. Selection does not execute tests. Run the returned files through `decision-os-verify` or `trace-evidence`.

---

## B. Invocation

```bash
node bin/decision-os-test-impact.mjs --json <oldest-commit> <newest-commit>
```

The commits must form one ordered ancestry chain. The final commit is the analyzed repository snapshot.

Use an existing graph for deterministic inspection:

```bash
node bin/decision-os-test-impact.mjs \
  --graph /path/to/graph.json \
  --json \
  <commit>
```

---

## C. Graphify Contract

1. The CLI uses `graphifyy` version `0.9.22`, MIT license, through pinned `uvx` delivery.
2. Extraction runs against a temporary `git archive` of the final commit, never the mutable working tree.
3. Extraction uses local AST relationships through `--code-only --no-cluster`; it performs no semantic LLM analysis.
4. CI can supply direct pinned argv through `DECISION_OS_TEST_IMPACT_GRAPHIFY_COMMAND` as a JSON string array.

---

## D. Result Contract

1. `changedTests` contains test files directly changed by the series and still present in the final snapshot.
2. `affectedTests` contains test files reached by reverse transitive traversal from changed code.
3. `selectedTests` contains the deduplicated union with one reason and dependency path per test.
4. `deletedTests` preserves deleted test paths without presenting them as runnable.
5. `unmappedChangedFiles` exposes changed paths that static code relationships did not map.
