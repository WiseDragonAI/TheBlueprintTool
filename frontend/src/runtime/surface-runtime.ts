/**
 * WHAT: Selects and mounts one operator surface from route identity and viewport capability.
 * WHY: Responsive application and canvas components must not share DOM, styles, or input runtimes.
 */
import { routeScope } from './navigation/helper/route-scope.js';
import { loadSurfaceScripts, loadSurfaceStylesheets } from './surface/helper/load-surface-assets.js';

const scope = routeScope(window.location.pathname);
const wideCanvas = window.matchMedia?.('(min-width: 761px)').matches !== false;
const canvasRoute = scope.view === 'projects'
  || Boolean(scope.projectId && ['ledgers', 'ledger'].includes(scope.view));

if (wideCanvas && canvasRoute) {
  await Promise.all([
    loadSurfaceStylesheets([
      { id: 'canvas-surface-styles', href: '/assets/canvas.css' },
      { id: 'canvas-nouislider-styles', href: '/assets/vendor/nouislider-15.8.1.min.css' },
    ]),
    loadSurfaceScripts([{ id: 'canvas-nouislider-script', src: '/assets/vendor/nouislider-15.8.1.min.js' }]),
  ]);
  const { renderCanvasSurfaceShell } = await import('./component/render-canvas-surface-shell.js');
  renderCanvasSurfaceShell();
  await import('./canvas-runtime.js');
} else {
  const { bootApplication } = await import('../app/controller/boot-application.js');
  await bootApplication();
}
