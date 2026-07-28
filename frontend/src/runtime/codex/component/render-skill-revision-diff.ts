/**
 * WHAT: Renders one immutable skill revision with the existing Pierre diff integration.
 * WHY: Authors need Git-native revision inspection with accessible red removals and blue additions.
 */
type PierreModule = typeof import('@pierre/diffs');

let pierrePromise: Promise<PierreModule> | null = null;

function loadPierre(): Promise<PierreModule> {
  const load = new Function('path', 'return import(path)') as (path: string) => Promise<PierreModule>;
  pierrePromise ??= load('/assets/vendor/pierre-diffs-1.2.12.js');
  return pierrePromise;
}

export async function renderSkillRevisionDiff(input: {
  host: HTMLElement;
  patch: string;
  commit: string;
  isCurrent?: () => boolean;
}, loadModule: () => Promise<PierreModule> = loadPierre): Promise<() => void> {
  const pierre = await loadModule();
  if (!input.host.isConnected || input.isCurrent?.() === false) return () => {};
  const parsed = pierre.parsePatchFiles(input.patch, input.commit, true)[0]?.files[0];
  if (!parsed) throw new Error('This revision did not produce a renderable diff.');
  const container = document.createElement(pierre.DIFFS_TAG_NAME) as HTMLElement;
  container.className = 'skill-revision-pierre';
  container.setAttribute('role', 'group');
  container.setAttribute('aria-label', 'File changes. Removed lines use a minus sign and red. Added lines use a plus sign and blue.');
  container.style.setProperty('--diffs-addition-color', '#4d9cff');
  container.style.setProperty('--diffs-deletion-color', '#ff5f6d');
  input.host.replaceChildren(container);
  const renderer = new pierre.FileDiff({
    themeType: 'dark',
    diffStyle: 'unified',
    diffIndicators: 'classic',
    overflow: 'wrap',
    disableFileHeader: true,
  });
  renderer.render({ fileDiff: parsed, fileContainer: container });
  return () => renderer.cleanUp();
}
