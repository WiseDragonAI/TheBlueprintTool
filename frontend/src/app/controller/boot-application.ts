/**
 * WHAT: Mounts the responsive application and starts its complete feature runtime.
 * WHY: The former mobile implementation is the source of truth for every non-canvas viewport.
 */
import { renderResponsiveApplicationShell } from '../component/render-responsive-application-shell.js';
import { loadSurfaceScripts, loadSurfaceStylesheets } from '../../runtime/surface/helper/load-surface-assets.js';

export async function bootApplication(): Promise<void> {
  await Promise.all([
    loadSurfaceStylesheets([
      { id: 'responsive-shared-styles', href: '/assets/application-shared.css' },
      { id: 'responsive-vendor-styles', href: '/assets/vendor/nouislider-15.8.1.min.css' },
      { id: 'responsive-application-styles', href: '/assets/application.css' },
      { id: 'responsive-runtime-status-styles', href: '/assets/runtime-status.css' },
      { id: 'responsive-content-authoring-styles', href: '/assets/shared/content-authoring.css' },
    ]),
    loadSurfaceScripts([
      { id: 'responsive-sortable-script', src: '/assets/vendor/sortable-1.15.7.min.js' },
      { id: 'responsive-embla-script', src: '/assets/vendor/embla-carousel-8.6.0.umd.js' },
      { id: 'responsive-interact-script', src: '/assets/vendor/interact-1.10.27.min.js' },
      { id: 'responsive-nouislider-script', src: '/assets/vendor/nouislider-15.8.1.min.js' },
    ]),
  ]);
  renderResponsiveApplicationShell();
  await import('../responsive/application.js');
}
