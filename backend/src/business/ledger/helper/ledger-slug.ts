/**
 * WHAT: Converts ledger titles and ids into stable filesystem-safe slugs.
 * WHY: Ledger ids, JSON filenames, and scoped card/thread directories must move together on rename.
 */
export function ledgerSlug(value: unknown): string {
  return String(value || 'New Ledger')
    .toLowerCase()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'new-ledger';
}
