/**
 * WHAT: Mounts the responsive application and starts its complete feature runtime.
 * WHY: The former mobile implementation is the source of truth for every non-canvas viewport.
 */
import { renderResponsiveApplicationShell } from '../component/render-responsive-application-shell.js';

export async function bootApplication(): Promise<void> {
  const responsiveStyles = document.querySelector<HTMLLinkElement>('#responsive-application-styles');
  // WHAT: Activate application styles only after route selection chooses the responsive surface.
  // WHY: The mobile control system must not leak into the dedicated desktop canvas presentation.
  if (responsiveStyles) responsiveStyles.media = 'all';
  renderResponsiveApplicationShell();
  await import('../responsive/application.js');
}
