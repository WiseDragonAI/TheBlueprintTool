/**
 * WHAT: Selects and boots the shared non-canvas feature view for the canonical route.
 * WHY: One frontend entry must serve desktop operations and compact resource navigation.
 */
import { renderApplicationError, renderApplicationShell } from '../effect/render-application-shell.js';
import { renderControlRoomView } from '../../features/control-room/controller/render-control-room-view.js';
import { renderProjectDetail, renderProjectsIndex } from '../../features/projects/controller/render-projects-view.js';
import { renderAggregateLedgers, renderCompactResource, renderLibrary, renderSettings } from '../../features/resources/controller/render-resource-view.js';
import { routeScope } from '../../runtime/navigation/helper/route-scope.js';
import { installProjectRequestScope } from '../../runtime/project/helper/project-request-scope.js';

export async function bootApplication(): Promise<void> {
  installProjectRequestScope();
  const container = renderApplicationShell();
  const scope = routeScope(location.pathname);
  try {
    if (scope.view === 'control-room') await renderControlRoomView(container);
    else if (scope.view === 'projects') await renderProjectsIndex(container);
    else if (scope.view === 'project') await renderProjectDetail(container, scope.projectId);
    else if (scope.view === 'ledgers' && !scope.projectId) await renderAggregateLedgers(container);
    else if (scope.view === 'settings') await renderSettings(container);
    else if (scope.view === 'skills' || scope.view === 'pipelines') await renderLibrary(container, scope.view);
    else if (scope.projectId) await renderCompactResource(container, scope);
    else throw new Error('Unknown application route.');
  } catch (error) {
    renderApplicationError(container, error);
  }
}
