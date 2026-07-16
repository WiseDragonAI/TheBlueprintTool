/**
 * WHAT: Resolves the registered project represented by a hovered projects-canvas card.
 * WHY: Hierarchical zoom must enter an explicit project instead of guessing from canvas position.
 */
export function resolveHoveredOverviewTargetProject(target: EventTarget | null): string {
  const element = target as HTMLElement | null;
  const card = element?.closest?.('.card[data-target-project-id]') as HTMLElement | null;
  return String(card?.dataset.targetProjectId ?? '').trim();
}
