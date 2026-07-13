/**
 * WHAT: Decodes the structured todo snapshot carried by a normalized Codex run event.
 * WHY: The log renderer needs exact booleans without reverse-parsing display Markdown.
 */
export type CodexTodoListItem = { text: string; completed: boolean };

export function codexTodoListItems(output: string): CodexTodoListItem[] {
  try {
    const value = JSON.parse(output) as unknown;
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
      const record = entry as Record<string, unknown>;
      const text = String(record.text ?? '').trim();
      return text ? [{ text, completed: record.completed === true }] : [];
    });
  } catch {
    return [];
  }
}
