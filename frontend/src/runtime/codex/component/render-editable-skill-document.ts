/**
 * WHAT: Renders one skill file with an accessible edit activation on its filename.
 * WHY: The served Skills detail must preserve its readable document while making the file itself open the authoring editor.
 */
export function renderEditableSkillDocument(input: {
  filename: string;
  markdown: string;
  editable: boolean;
  readOnlyReason?: string | null;
  renderMarkdown: (markdown: string) => HTMLElement;
  onEdit: () => void;
}): HTMLElement {
  const section = document.createElement('section');
  section.className = 'skill-markdown-section';
  if (input.editable) {
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'skill-document-edit';
    edit.textContent = input.filename;
    edit.setAttribute('aria-label', `Edit ${input.filename}`);
    edit.addEventListener('click', input.onEdit);
    section.append(edit);
  } else {
    const heading = document.createElement('h4');
    heading.textContent = input.filename;
    if (input.readOnlyReason) heading.title = input.readOnlyReason;
    section.append(heading);
  }
  section.append(input.renderMarkdown(input.markdown));
  return section;
}
