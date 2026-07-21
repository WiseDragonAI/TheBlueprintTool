# Current-System Documentation

## A. Purpose

1. This role describes how `decision-os` currently works.
2. It records operator surfaces, Root Blocks, runtime ownership, persistence boundaries, routes, and integration points.
3. Requirements belong in `../specs/`; execution steps belong in `../procedure/`; failure analysis belongs in `../postmortem/`.

---

## B. Domains

1. [Product](./product/README.md) explains the operator-facing workspace, ledgers, cards, threads, projects, and controls.
2. [Architecture](./architecture/README.md) explains the repository Root Blocks, runtime flow, persistence, and verification surfaces.

---

## C. Evidence Policy

1. Current-state claims must cite repository files, symbols, routes, tests, runtime output, or ledger data.
2. When implementation and prose disagree, record the contradiction and verify the served behavior before changing canon.
3. Do not turn a temporary plan or active task state into current-system documentation.
