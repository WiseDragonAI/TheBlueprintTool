/**
 * WHAT: Removes all SVG relationship label text nodes from the active overlays.
 * WHY: Low-detail should not retain detail-exposed relationship text nodes that are hidden anyway.
 */
export function clearRelationshipLabels(): void {
  for (const overlay of document.querySelectorAll<SVGSVGElement>('.relationships')) {
    // Branch: Keep the relationship paths and markers intact while removing only the reused text survivor nodes.
    overlay.querySelectorAll('[data-relationship-label]').forEach((node) => node.remove());
  }
}
