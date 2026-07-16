/**
 * WHAT: Runtime tests for thread terminal accent inheritance.
 * WHY: The side terminal must preserve card and zone color identity, including the voice widget graph.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clampCardCodeColor } from '../../src/runtime/card/effect/render-card-zone-colors.js';
import { mergeLocalThreadNotes } from '../../src/runtime/ledger/helper/merge-local-thread-notes.js';
import { state } from '../../src/runtime/state.js';
import { colorToRgbChannels, lightenColorInHsv } from '../../src/runtime/thread/helper/color-to-rgb-channels.js';
import { resolveThreadTargetAccent } from '../../src/runtime/thread/helper/resolve-thread-target-accent.js';

const root = new URL('../../../', import.meta.url);

test('thread accent resolves card zone color before selected border color', () => {
  const previousGetComputedStyle = globalThis.getComputedStyle;
  try {
    globalThis.getComputedStyle = ((() => ({
      getPropertyValue: (property: string) => property === '--card-zone-color' ? '#3344ff' : '',
      borderTopColor: 'rgb(255, 255, 255)'
    })) as unknown) as typeof getComputedStyle;
    const target = { dataset: { cardZoneColor: '#1122ee' } } as unknown as HTMLElement;
    assert.equal(resolveThreadTargetAccent(target), '#1122ee');
  } finally {
    globalThis.getComputedStyle = previousGetComputedStyle;
  }
});

test('thread accent colors feed the voice widget graph and frame', () => {
  assert.equal(colorToRgbChannels('#123abc'), '18, 58, 188');
  assert.equal(lightenColorInHsv('#123abc'), 'rgb(24, 79, 255)');
  assert.equal(lightenColorInHsv('rgb(80, 160, 120)'), 'rgb(123, 247, 185)');
  assert.equal(clampCardCodeColor('#4b00ff'), '#8968d9');
  const shellCss = readFileSync(new URL('frontend/assets/canvas/shell.css', root), 'utf8');
  const threadCss = readFileSync(new URL('frontend/assets/canvas/thread.css', root), 'utf8');
  const terminalButtonCss = readFileSync(new URL('frontend/assets/canvas/terminal-button.css', root), 'utf8');
  const colorRuntime = readFileSync(new URL('frontend/src/runtime/card/effect/render-card-zone-colors.ts', root), 'utf8');
  const controlsCss = readFileSync(new URL('frontend/assets/canvas/terminal-chat-controls.css', root), 'utf8');
  const accentEffect = readFileSync(new URL('frontend/src/runtime/thread/effect/apply-thread-accent.ts', root), 'utf8');
  const threadNotesRenderer = readFileSync(new URL('frontend/src/runtime/thread/effect/render-thread-notes.ts', root), 'utf8');
  const threadPanelRenderer = readFileSync(new URL('frontend/src/runtime/thread/effect/render-thread-panel.ts', root), 'utf8');
  const threadLogRenderer = readFileSync(new URL('frontend/src/runtime/thread/effect/render-thread-codex-log.ts', root), 'utf8');
  const indexHtml = readFileSync(new URL('frontend/index.html', root), 'utf8');
  const compactThread = readFileSync(new URL('frontend/src/features/threads/controller/open-compact-thread.ts', root), 'utf8');
  const applicationCss = readFileSync(new URL('frontend/assets/application.css', root), 'utf8');
  const mediaRenderer = readFileSync(new URL('frontend/src/runtime/ledger/component/render-ledger-card-media.ts', root), 'utf8');
  assert.match(shellCss, /-34px 0 68px rgba\(0, 0, 0, 0\.86\)/);
  assert.match(threadCss, /voice-panel[\s\S]*--thread-accent/);
  assert.match(threadCss, /thread-panel \.chat[\s\S]*padding: 18px 20px 28px/);
  assert.match(threadCss, /thread-chat-shell\s*{[\s\S]*position: relative;[\s\S]*overflow: hidden;/);
  assert.match(threadCss, /thread-note-list[\s\S]*padding: 0;/);
  assert.doesNotMatch(threadCss, /thread-note-list[\s\S]*padding: 0 62px 42px 0/);
  assert.match(threadCss, /thread-note p,[\s\S]*font-size: 14px/);
  assert.match(threadCss, /thread-note\.is-operator[\s\S]*border-left: 2px solid color-mix\(in srgb, var\(--thread-accent\)/);
  assert.match(threadCss, /thread-note\.is-operator[\s\S]*background: #111315/);
  assert.match(threadCss, /thread-note\.is-agent[\s\S]*background: transparent/);
  assert.match(threadCss, /thread-note-message code[\s\S]*font-size: 1em/);
  assert.match(threadCss, /thread-note-message \.ledger-card-heading[\s\S]*--thread-heading-color/);
  assert.match(threadCss, /thread-note-message \.ledger-card-hr[\s\S]*border-top-color: rgba\(255, 255, 255, 0\.18\)/);
  assert.match(threadCss, /thread-feed\s*{[\s\S]*min-width: 0;[\s\S]*min-height: 0;/);
  assert.match(threadCss, /thread-heading\s*{[\s\S]*position: sticky;[\s\S]*grid-template-rows: 28px 28px;/);
  assert.match(threadCss, /thread-toolbar\s*{[\s\S]*justify-content: flex-end;[\s\S]*white-space: nowrap;/);
  assert.match(threadCss, /thread-actions\s*{[\s\S]*grid-template-columns: minmax\(112px, 1fr\) 84px auto;/);
  assert.match(threadCss, /thread-actions\[hidden\]\s*{[\s\S]*display: none;/);
  const runButtonRule = threadCss.match(/\.thread-codex-button\s*{([^}]*)}/)?.[1] ?? '';
  assert.match(terminalButtonCss, /\.terminal-button\s*{[\s\S]*--terminal-button-background: #181818;/);
  assert.match(runButtonRule, /--terminal-button-color: #74d680;/);
  assert.doesNotMatch(runButtonRule, /--terminal-button-background|--fx-shell-control/);
  assert.match(threadCss, /thread-heading\[data-codex-running="true"\]\s*{[^}]*grid-template-rows: 28px;[^}]*gap: 0;/);
  assert.match(threadCss, /thread-tab\[aria-selected="true"\][\s\S]*box-shadow:/);
  assert.match(threadCss, /@property --thread-codex-log-angle\s*{[\s\S]*syntax: "<angle>"/);
  assert.match(threadCss, /thread-tab\[data-run-status="running"\]::before\s*{[\s\S]*conic-gradient\([\s\S]*#18f0ff[\s\S]*#7559ff[\s\S]*#ffe24a[\s\S]*animation: thread-codex-log-running 1\.65s linear infinite/);
  assert.match(threadCss, /prefers-reduced-motion: reduce[\s\S]*thread-tab\[data-run-status="running"\]::before[\s\S]*animation: none/);
  assert.match(threadCss, /thread-conversation-scroll,[\s\S]*thread-log-scroll[\s\S]*overflow: auto;/);
  assert.match(threadCss, /codex-log-status\[data-run-status="failed"\],[\s\S]*border-left-color: #ff6473/);
  assert.match(threadCss, /codex-tool-group-summary:focus-visible,[\s\S]*outline: 2px solid/);
  assert.doesNotMatch(threadCss, /thread-note\.is-codex-run-event/);
  assert.match(threadCss, /thread-jump-bottom-frame\s*{[\s\S]*position: absolute;[\s\S]*right: 18px;[\s\S]*bottom: 16px;/);
  assert.match(threadCss, /thread-jump-bottom\s*{[\s\S]*width: 34px;[\s\S]*height: 34px;/);
  assert.match(threadCss, /thread-jump-bottom:hover\s*{[\s\S]*transform: translateY\(-1px\)/);
  assert.match(threadCss, /thread-jump-bottom:focus-visible\s*{[\s\S]*outline: 1px solid/);
  assert.match(threadCss, /thread-jump-bottom-chevron::before\s*{[\s\S]*transform: rotate\(45deg\)/);
  assert.match(threadCss, /thread-note\s*{[\s\S]*min-width: 0;[\s\S]*max-width: min\(86%, 520px\)/);
  assert.match(threadCss, /thread-note-message\s*{[\s\S]*min-width: 0;[\s\S]*max-width: 100%;/);
  assert.match(threadCss, /thread-note-message \.ledger-card-body,[\s\S]*thread-note-message \.ledger-card-table-scroll\s*{[\s\S]*max-width: 100%;/);
  assert.match(threadCss, /thread-note-message \.ledger-card-media-thread\s*{[\s\S]*width: min\(320px, 100%\);[\s\S]*max-width: none;[\s\S]*resize: none;/);
  assert.match(threadCss, /thread-note-message \.ledger-card-media-thread-resize\s*{[\s\S]*cursor: ew-resize;[\s\S]*touch-action: none;/);
  assert.match(threadCss, /thread-note-message \.ledger-card-media-thread \.ledger-card-media-image\s*{[\s\S]*width: 100%;[\s\S]*height: 100%;/);
  assert.match(threadCss, /--card-code-color: var\(--thread-code-color/);
  assert.match(threadCss, /thread-note-delete\.terminal-button[\s\S]*width: 24px/);
  assert.match(threadCss, /thread-draft[\s\S]*border: 0/);
  assert.match(threadCss, /thread-draft[\s\S]*background: #111315/);
  assert.match(colorRuntime, /const CODE_COLOR_VALUE = 0\.85;/);
  assert.doesNotMatch(threadCss, /thread-draft[\s\S]*border: 1px solid color-mix\(in srgb, var\(--thread-accent\)/);
  assert.doesNotMatch(threadCss, /color-mix\(in srgb, #15181c, var\(--thread-accent\)/);
  assert.match(controlsCss, /meter-fill[\s\S]*--thread-accent/);
  assert.match(controlsCss, /wave-panel[\s\S]*--thread-accent/);
  assert.match(accentEffect, /clampCardCodeColor/);
  assert.match(accentEffect, /--thread-code-color/);
  assert.match(accentEffect, /--thread-heading-color/);
  assert.match(accentEffect, /--card-code-color/);
  assert.match(accentEffect, /--voice-graph-secondary/);
  assert.match(accentEffect, /inspector\?\.style\.setProperty\('--thread-accent'/);
  assert.match(threadNotesRenderer, /mediaSurface: 'thread'/);
  assert.match(threadNotesRenderer, /imageSizes: threadImageSizes\(note\.imageSizes\)/);
  assert.match(threadNotesRenderer, /sendActiveLedgerMutation\(\{[\s\S]*action: 'update-note'[\s\S]*imageSizes/);
  assert.doesNotMatch(threadNotesRenderer, /input\.note\.optimistic\)\s*return/);
  assert.doesNotMatch(threadNotesRenderer, /codexKind|renderCodexToolCallNote/);
  assert.match(threadPanelRenderer, /threadTabOrder: ThreadPanelTab\[\] = \['thread', 'codex-log'\]/);
  assert.match(threadPanelRenderer, /event\.key === 'ArrowRight'[\s\S]*event\.key === 'ArrowLeft'[\s\S]*event\.key === 'Home'[\s\S]*event\.key === 'End'/);
  assert.match(threadLogRenderer, /No Codex run for this thread\./);
  assert.match(threadLogRenderer, /document\.createElement\('details'\)/);
  assert.match(indexHtml, /role="tablist"[\s\S]*role="tab"[\s\S]*role="tabpanel"/);
  assert.match(indexHtml, /thread-toolbar[\s\S]*thread-target[\s\S]*thread-tabs[\s\S]*data-action="close-thread-panel"[\s\S]*thread-actions/);
  assert.match(compactThread, /thread-toolbar[\s\S]*thread-tabs[\s\S]*close-thread-panel[\s\S]*thread-actions/);
  assert.match(compactThread, /class="thread-target"/);
  assert.doesNotMatch(compactThread, /thread-title-row/);
  assert.match(applicationCss, /compact-thread-inspector \.thread-heading\s*{[^}]*grid-template-rows: 44px 44px;[^}]*gap: 12px;/);
  assert.match(applicationCss, /compact-thread-inspector \.thread-heading\[data-codex-running="true"\]\s*{[^}]*grid-template-rows: 44px;[^}]*gap: 0;/);
  assert.match(applicationCss, /compact-thread-inspector \.thread-toolbar\s*{[^}]*justify-content: flex-end;[^}]*gap: 8px;/);
  assert.match(applicationCss, /compact-thread-inspector \.thread-actions\s*{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);[^}]*gap: 8px;[^}]*width: 100%;/);
  assert.match(applicationCss, /compact-thread-inspector \.thread-codex-button\s*{[^}]*width: 100%;[^}]*height: 44px;[^}]*min-height: 44px;/);
  assert.match(mediaRenderer, /mediaSurface !== 'thread'[\s\S]*watchContainedImageSizing\(shell\)/);
  assert.match(mediaRenderer, /renderThreadImageResizeHandle\(shell, options, sizeSource\)/);
});

test('thread note image resize survives stale server ledger merges', () => {
  const previousLedger = state.activeLedger;
  try {
    state.activeLedger = {
      notes: {
        'thread-card-a': [
          {
            id: 'note-image',
            role: 'operator',
            message: '![Image](.decision-os/thread/image.png)',
            imageSizes: {
              '.decision-os/thread/image.png': { width: 184, height: 92 }
            }
          }
        ]
      }
    };
    const merged = mergeLocalThreadNotes({
      notes: {
        'thread-card-a': [
          {
            id: 'note-image',
            role: 'operator',
            message: '![Image](.decision-os/thread/image.png)'
          }
        ]
      }
    });
    assert.deepEqual(merged?.notes['thread-card-a'][0].imageSizes, {
      '.decision-os/thread/image.png': { width: 184, height: 92 }
    });
  } finally {
    state.activeLedger = previousLedger;
  }
});
