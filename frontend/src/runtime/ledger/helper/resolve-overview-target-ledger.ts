export function resolveHoveredOverviewTargetLedger(target: EventTarget | null): string {
  const element = target as HTMLElement | null;
  const card = element?.closest?.('.card[data-target-ledger-id]') as HTMLElement | null;
  return String(card?.dataset.targetLedgerId ?? '').trim();
}
