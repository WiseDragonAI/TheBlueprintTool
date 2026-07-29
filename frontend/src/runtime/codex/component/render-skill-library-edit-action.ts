/**
 * WHAT: Renders the explicit authoring action beside one skill-library record.
 * WHY: Skill and pipeline-prompt catalogs need the same visible edit boundary without nesting controls.
 */
export function renderSkillLibraryEditAction(input: {
  contentKind?: string;
  editable?: boolean;
  readOnlyReason?: string | null;
  onEdit: () => void;
}): HTMLElement {
  const cell = document.createElement('div');
  cell.className = 'process-skill-edit-cell';
  if (input.editable) {
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'ghost-button skill-library-edit-action';
    edit.textContent = input.contentKind === 'pipeline-prompt' ? 'Edit prompt' : 'Edit skill';
    edit.addEventListener('click', input.onEdit);
    cell.append(edit);
    return cell;
  }
  const reason = document.createElement('span');
  reason.className = 'codex-readonly-reason';
  reason.textContent = input.readOnlyReason || 'Read-only skill';
  cell.append(reason);
  return cell;
}
