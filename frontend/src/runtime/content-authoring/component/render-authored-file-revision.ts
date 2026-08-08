/**
 * WHAT: Renders owner-neutral cursor history navigation, immutable Markdown preview, and an accessible introduced-change diff.
 * WHY: Skills and Task cards need the same complete older-to-selected revision presentation.
 */
export type AuthoredFileRevisionSummary = {
  commit: string;
  authoredAt: string;
  subject: string;
  authorName?: string;
  authorEmail?: string;
};

export type AuthoredFileRevisionDetail = AuthoredFileRevisionSummary & {
  markdown: string;
  patch: string;
};

function action(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ghost-button';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

export function renderAuthoredFileRevision(input: {
  host: HTMLElement;
  revisions: readonly AuthoredFileRevisionSummary[];
  selectedIndex: number;
  selectedDetail: AuthoredFileRevisionDetail | null;
  loading: boolean;
  hasOlderPage: boolean;
  filename: string;
  showPreview?: boolean;
  onSelect: (index: number) => void;
  onRequestOlderPage: () => void;
  mountPreview: (host: HTMLElement, detail: AuthoredFileRevisionDetail) => void;
  mountDiff: (host: HTMLElement, detail: AuthoredFileRevisionDetail) => void;
}): void {
  const browser = document.createElement('section');
  browser.className = 'skill-revision-browser';
  if (!input.revisions.length) {
    const empty = document.createElement('p');
    empty.className = 'codex-empty-state';
    empty.textContent = 'No Git revisions are available for this file.';
    browser.append(empty);
    input.host.replaceChildren(browser);
    return;
  }
  const index = Math.max(0, Math.min(input.selectedIndex, input.revisions.length - 1));
  const selected = input.revisions[index];
  const navigation = document.createElement('nav');
  navigation.className = 'skill-revision-navigation';
  navigation.setAttribute('aria-label', `${input.filename} revision history`);
  const newer = action('Newer', () => input.onSelect(index - 1));
  const older = action('Older', () => {
    if (index < input.revisions.length - 1) input.onSelect(index + 1);
    else input.onRequestOlderPage();
  });
  newer.disabled = input.loading || index === 0;
  older.disabled = input.loading || (index === input.revisions.length - 1 && !input.hasOlderPage);
  const identity = document.createElement('div');
  const subject = document.createElement('strong');
  subject.textContent = selected.subject;
  const metadata = document.createElement('small');
  const author = selected.authorName ? ` · ${selected.authorName}` : '';
  metadata.textContent = `${index + 1} · ${selected.commit.slice(0, 12)} · ${new Date(selected.authoredAt).toLocaleString()}${author}`;
  identity.append(subject, metadata);
  navigation.append(newer, identity, older);
  const key = document.createElement('p');
  key.className = 'skill-revision-key';
  key.setAttribute('aria-label', 'Diff key: minus means removed in red; plus means added in blue');
  key.innerHTML = '<span class="is-removal">− Removed</span><span class="is-addition">+ Added</span>';
  const content = document.createElement('div');
  content.className = `authored-revision-content${input.showPreview === false ? ' is-single-column' : ''}`;
  if (input.loading || input.selectedDetail?.commit !== selected.commit) {
    content.textContent = 'Loading revision…';
  } else {
    const diff = document.createElement('section');
    diff.className = 'skill-revision-viewport';
    diff.setAttribute('role', 'region');
    diff.setAttribute('aria-label', `${input.filename} changes introduced by revision ${selected.commit.slice(0, 12)}`);
    if (input.showPreview === false) {
      content.append(diff);
    } else {
      const preview = document.createElement('section');
      preview.className = 'authored-revision-preview';
      preview.setAttribute('role', 'region');
      preview.setAttribute('aria-label', `${input.filename} full historical Markdown`);
      content.append(preview, diff);
      input.mountPreview(preview, input.selectedDetail);
    }
    input.mountDiff(diff, input.selectedDetail);
  }
  browser.append(navigation, key, content);
  input.host.replaceChildren(browser);
}
