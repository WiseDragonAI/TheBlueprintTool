/**
 * WHAT: Renders one skill file with accessible Markdown copy and editable-file activation controls.
 * WHY: The served Skills detail must expose its exact readable Markdown without changing the existing authoring boundary.
 */
export function renderEditableSkillDocument(input: {
  filename: string;
  markdown: string;
  editable: boolean;
  readOnlyReason?: string | null;
  renderMarkdown: (markdown: string) => HTMLElement;
  onEdit: () => void;
  copyMarkdown: (markdown: string) => Promise<void>;
}): HTMLElement {
  const section = document.createElement('section');
  section.className = 'skill-markdown-section';
  const header = document.createElement('div');
  header.className = 'skill-document-header';
  if (input.editable) {
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'skill-document-edit';
    edit.textContent = input.filename;
    edit.setAttribute('aria-label', `Edit ${input.filename}`);
    edit.addEventListener('click', input.onEdit);
    header.append(edit);
  } else {
    const heading = document.createElement('h4');
    heading.textContent = input.filename;
    if (input.readOnlyReason) heading.title = input.readOnlyReason;
    header.append(heading);
  }
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'codex-secondary skill-document-copy';
  copy.textContent = 'Copy';
  copy.setAttribute('aria-label', `Copy ${input.filename} Markdown`);
  copy.addEventListener('click', () => {
    copy.disabled = true;
    void Promise.resolve()
      .then(() => input.copyMarkdown(input.markdown))
      .then(() => {
        copy.textContent = 'Copied';
        copy.setAttribute('aria-label', `${input.filename} Markdown copied`);
      })
      .catch(() => {
        copy.textContent = 'Copy failed';
        copy.setAttribute('aria-label', `Copy ${input.filename} Markdown failed`);
      })
      .finally(() => { copy.disabled = false; });
  });
  header.append(copy);
  section.append(header);
  section.append(input.renderMarkdown(input.markdown));
  return section;
}
