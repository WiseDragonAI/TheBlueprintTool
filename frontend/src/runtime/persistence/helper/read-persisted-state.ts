export function readPersistedState(): Record<string, unknown> {
  try {
    return JSON.parse(localStorage.getItem('decision-os.canvas.state') ?? '{}');
  } catch {
    return {};
  }
}
