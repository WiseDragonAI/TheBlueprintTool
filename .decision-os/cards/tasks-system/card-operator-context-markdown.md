## What This Is For

- **Decision OS** is a local browser canvas for decision and ledger work.
- Operators use it to inspect ledgers, edit canvas objects, review evidence, and capture notes.
- The workspace is organized around `cards`, `zones`, `groups`, `relationships`, and `threads`.
- The active workspace separates `Specs`, `Data`, `Performances`, and `Tasks System`.

## Workspace Shape

- **The main workspace is a canvas**, not a linear document.
- Operators navigate it through `pan`, `zoom`, active ledger state, and viewport state.
- The canvas contains cards, zones, groups, relationships, labels, overlays, and controls.
- Detail changes with zoom through low-detail and hydrated card states.

## What Operators Can Do

- Open a `ledger` route and review the canvas.
- Create, move, select, resize, copy, paste, and delete canvas objects.
- Arrange work with `cards`, `zones`, `groups`, and `relationships`.
- Review specs, performance evidence, reports, media, and mockups.

## Content Work

- Edit card descriptions, fields, and Markdown content.
- Inspect image carousels, HTML assets, media, and report cards.
- Paste files or images into threads.
- Record voice notes and retry transcription when needed.

## Main Surfaces

- The `tab registry` and ledger routes choose the active workspace.
- The full-canvas ledger surface holds the spatial work map.
- The card detail layer shows descriptions, fields, Markdown, media, and HTML assets.
- The right-side thread inspector holds notes, uploads, voice flow, and the composer.

## Controls That Matter

- `A` opens or focuses the thread panel.
- `X` starts or stops the active voice note.
- `Esc` cancels capture, closes tooling, or clears selection.
- `Del`, `Ctrl+C`, `Ctrl+V`, and `Ctrl+D` handle deletion, copy, paste, and resize.

## Operator Workflow

- Open a ledger route, then review the canvas.
- Select or create cards, zones, or groups.
- Edit geometry or content, then open the thread panel.
- Write or record notes, then review replies, media, reports, or mockups.

## Handoffs

- Operator notes hand work to agents through thread files.
- Voice capture moves through recording, upload, transcription, note update, and retry.
- External filesystem edits refresh visible ledger content through server-sent events.
- Card Markdown moves through backend hydration and frontend rendering.

## Useful Constraints

- Rich card detail appears only when detail is visible.
- Pan, zoom, and drag must stay responsive.
- Delete actions require confirmation.
- Thread and voice tooling must not steal editing keystrokes.

## Content Rules

- Media dimensions persist independently from canvas zoom.
- HTML embeds must stay under allowed card asset paths.
- Agent replies must be in English.
- Durable card content should stay concrete and traceable.

## Source Boundary

- Source: `.decision-os/cards/tasks-system/card-0b144d6a-16a1-4cc2-9b9f-32aabafd5b4a.md`.
- Scope: operator-facing features, surfaces, controls, workflows, handoffs, and use constraints.
- Excluded: adjacent repo inference, generic dashboard metrics, and implementation inventory not needed by an operator.
