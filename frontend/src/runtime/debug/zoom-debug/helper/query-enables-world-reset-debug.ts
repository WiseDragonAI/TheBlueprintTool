/**
 * WHAT: Reads URL parameters that enable the low-detail world-node reset experiment.
 * WHY: The retained world-layer hypothesis should be testable without forcing the experiment into the default runtime path.
 */
export function queryEnablesWorldResetDebug(): boolean {
  const params = new URLSearchParams(window.location.search);
  const worldResetValue = params.get('worldResetDebug');
  if (params.has('worldResetDebug')) {
    // Branch: A bare ?worldResetDebug flag should enable the experiment because it is fastest to type during repro.
    return worldResetValue !== '0' && worldResetValue !== 'false';
  }
  // Branch: The generic debug parameter keeps world reset experiments grouped with other shareable debug routes.
  return params.get('debug') === 'world-reset';
}
