---
name: visual-mockup-generator
description: Convert a screen-content plan, UX plan, product analysis card, or equivalent screen description into visual mockups. Use when Codex needs to create one HTML file and one separate CSS file per screen, verify the target app context and platform, inspect recent related commits for current style, preserve the target UI language, render screenshots at the correct viewport or image ratio, and add Decision OS card-ready Markdown image carousels. This skill is the second step after screen-content-planner and may consume source text tightened by bloating-analysis.
---

# Visual Mockup Generator

## A. Formatting Contract

1. **Headings:** use `H2` card sections with uppercase letters: `## A. Scope`, `## B. Contract`, `## C. Acceptance Criteria`.
2. **Dividers:** put `---` between card sections.
3. **Lists:** write section content as numbered list items: `1.`, `2.`, `3.`.
4. **Bold:** use **bold** for the important words that carry the point.
5. **Backticks:** use `backticks` for technical, secondary, exact, or literal terms: file paths, routes, config keys, commands, IDs, statuses, branch names, code symbols, and literal values.

## Purpose

Turn grounded screen descriptions into visual mockups that can be inspected in Decision OS.

This skill follows `screen-content-planner`: consume its screen inventory, per-screen definitions, cross-screen coverage check, and handoff. If a bloat analysis has tightened the plan, use the tightened version as the source of truth and keep only concrete screen requirements.

## Required Inputs

Start from one of these artifacts:

1. A `screen-content-planner` output.
2. A product analysis card, implementation plan, UX analysis, or ticket with enough screen detail.
3. A concise screen description plus a target product or repo.

If screen boundaries, target app, target platform, UI language, or required states are missing and cannot be inferred, ask only the blocking questions. Do not ask for visual taste preferences before auditing the existing app.

## Workflow

1. **Extract screen contract.** Identify each screen, purpose, route or surface, actor, required sections, controls, data, states, edge cases, and source grounding.
2. **Verify app context and platform.** Inspect the repo structure, package files, lockfiles, framework config, native directories, route files, build targets, and README or product docs before deciding whether the target is web, mobile, desktop, extension, kiosk, or another surface. Do not infer `web` only because the repo contains JavaScript or TypeScript; React Native, Expo, Ionic, Electron, Capacitor, and hybrid apps also use JS/TS.
3. **Determine target format.** Choose viewport dimensions before designing. Use verified product context when known: mobile portrait `9:16`, mobile landscape `16:9`, tablet `4:3` or `3:4`, desktop app `16:10` or the product's existing viewport, square only when the source explicitly asks for square artifacts. Even when the target product is mobile or native, keep this skill's deliverable as HTML/CSS mockup files unless the user explicitly requests another artifact format.
4. **Review recent related commits.** Use recent commit history to identify the current style and product direction for the feature being mocked. Prefer targeted commands such as `git log --oneline -n 20 -- <relevant-path>`, `git show --stat <commit>`, and `git show <commit> -- <style-or-component-file>` after identifying likely feature, style, component, or mockup paths. Include the inspected commits or paths in the final answer.
5. **Audit existing visual system.** Before creating screens, inspect the target repo or provided artifacts for colors, typography, spacing, border radius, shadows, density, layout conventions, component styles, controls, empty states, and icon usage. Prefer recent app files and commits such as CSS variables, Tailwind config, theme files, component modules, screenshots, existing mockups, and changed files from recent related commits.
6. **Verify target UI language.** Inspect existing UI copy, locale files, i18n config, screenshots, product docs, route content, and recent commits to determine the language used in the actual interface. Do not assume English just because the card, analysis, or implementation plan is written in English. If the target UI language cannot be inferred and visible copy matters, ask a blocking question.
7. **Apply frontend-design quality with product coherence.** Use the design judgment from `frontend-design`, but ground the result in the audited app style, platform context, and target UI language. Mockups should look like a coherent extension of the current product, not a separate landing page or generic concept.
8. **Create separate source files.** For every screen, create exactly one `.html` file and one linked `.css` file. Keep CSS separate from HTML. Use local relative paths, deterministic mock data, and no external network dependency unless the source explicitly requires it.
9. **Build the real screen state.** Render actual UI content from the screen contract: headers, navigation, panels, forms, tables, cards, dialogs, empty/loading/error/permission states when required, and realistic values in the verified target UI language. Do not fill space with decorative explanations of what the screen does.
10. **Render screenshots.** Open each HTML file in a browser at the chosen viewport, verify the layout is nonblank and unclipped, then capture a PNG with the matching dimensions or aspect ratio.
11. **Update the Decision OS card when applicable.** Add a concise Markdown section with source file paths, viewport dimensions, app-context summary, design-system summary, language summary, and adjacent image-only Markdown references so Decision OS renders the screenshots as a carousel.
12. **Verify.** Check that every planned screen has HTML, CSS, PNG, and a card image reference; that text fits inside controls; that recent commits were considered; that the platform and viewport match the app context; that the UI language matches the product; and that the visual system matches the audited app.

## File Layout

When working in a Decision OS workspace, write generated files under:

1. **Source root:** `.decision-os/ui-mockups/<mockup-slug>/`.
2. **HTML:** `.decision-os/ui-mockups/<mockup-slug>/<screen-slug>.html`.
3. **CSS:** `.decision-os/ui-mockups/<mockup-slug>/<screen-slug>.css`.
4. **Screenshots:** `.decision-os/ui-mockups/<mockup-slug>/screenshots/<screen-slug>.png`.

For non-Decision OS workspaces, use a repo-local `mockups/<mockup-slug>/` folder unless the user names a different destination.

## HTML And CSS Rules

1. **One screen per HTML file.** Do not combine several screens into one long HTML file unless the user explicitly requests a comparison sheet.
2. **Separate CSS per screen.** Each HTML file must link its own CSS file. Shared CSS may be copied deliberately, but the deliverable remains one CSS file per HTML screen.
3. **No product implementation.** Mockup files are visual artifacts. Do not add application routes, production components, backend endpoints, or persistent app state unless the user explicitly asks to implement the product.
4. **Use real dimensions.** Set a stable root frame matching the render viewport so captures do not shift between runs.
5. **Respect existing UI density.** Match the audited product's compactness, control sizing, border radius, color accents, and typography scale.
6. **Use icons appropriately.** Prefer the existing icon system or lucide-style symbols when available. Do not replace obvious tool icons with text-only buttons.
7. **Keep text professional.** Labels, values, and statuses must be realistic and short enough to fit. Do not include visible instructions explaining the mockup process.

## Rendering

Use `scripts/render-html-screenshots.mjs` when Playwright is available:

```bash
node /home/jbb/.codex/skills/visual-mockup-generator/scripts/render-html-screenshots.mjs \
  --input .decision-os/ui-mockups/example/screen-a.html \
  --output .decision-os/ui-mockups/example/screenshots/screen-a.png \
  --width 390 \
  --height 844
```

For several screens, run the script once per HTML file or create a small repo-local loop. If Playwright is unavailable, use an available browser automation tool and keep the same viewport contract.

After rendering, visually inspect at least one desktop and one mobile capture when both formats are produced. For a single-format run, inspect every capture or use browser screenshots plus file checks to confirm the images are nonblank.

## Decision OS Card Markdown

When updating Decision OS card prose or producing Markdown output for a card, use this format:

1. **Sections:** Use `H2` headings only for main sections, prefixed with uppercase letters: `## A. Scope`, `## B. Visual System`, `## C. Mockup Files`.
2. **Subsections:** If subsections are necessary, prefix them with the parent letter and a number, for example `### B.1 Color Tokens`. Avoid subsections unless they clarify a large section.
3. **Section dividers:** Put `---` horizontal rules between sections.
4. **Numbered lists:** Use numbered lists for normal requirements and card content. Avoid unordered bullets in durable card prose.
5. **Labels:** Start important items with bold labels, for example `1. **Viewport:** \`390x844\`.`.
6. **Exact tokens:** Use backticks for file paths, config keys, API routes, statuses, viewport dimensions, and literal values.
7. **Image carousel:** Add screenshot references as adjacent standalone image-only lines:

```markdown
![Screen A mockup](.decision-os/ui-mockups/example/screenshots/screen-a.png)
![Screen B mockup](.decision-os/ui-mockups/example/screenshots/screen-b.png)
```

Do not manually edit ledger JSON for prose-only card updates.

## Output Checklist

Before finishing, confirm:

1. **Grounding:** Every mockup maps to a source screen definition or explicit assumption.
2. **App context:** The target platform and surface are verified from repo evidence, not guessed from the programming language.
3. **Recent commits:** The answer names relevant recent commits or commit-scoped paths inspected for current style.
4. **Style audit:** The answer names the app style files, screenshots, components, or existing mockups inspected.
5. **UI language:** Visible copy uses the target product language, or the answer names the unresolved language blocker.
6. **Artifacts:** Every screen has a `.html`, `.css`, and rendered `.png`.
7. **Viewport:** Every screenshot uses the chosen aspect ratio and dimensions.
8. **Card integration:** Decision OS cards use the required formatting and carousel image syntax.
9. **No bloat:** The card and final answer contain concrete artifacts, paths, dimensions, constraints, and verification only.
