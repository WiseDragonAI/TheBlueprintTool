export function readPersistedState(): Record<string, unknown> {
  try {
    return JSON.parse(localStorage.getItem('corev2.canvas.state') ?? '{}');
  } catch {
    return {};
  }
}
