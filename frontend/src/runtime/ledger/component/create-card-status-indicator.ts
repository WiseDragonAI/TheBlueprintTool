/**
 * WHAT: Creates the shared status badge used by detail and low-detail card presentation.
 * WHY: The runtime needs one canonical badge shape so mode changes do not drift visually.
 */
export function createCardStatusIndicator(status: string, className = 'card-status-indicator'): HTMLElement {
  const statusIndicator = document.createElement('span');
  statusIndicator.className = className;
  statusIndicator.dataset.spec = 'c4e8b91a';
  statusIndicator.title = `Card status: ${status}`;
  statusIndicator.ariaLabel = statusIndicator.title;
  statusIndicator.textContent = status;
  return statusIndicator;
}
