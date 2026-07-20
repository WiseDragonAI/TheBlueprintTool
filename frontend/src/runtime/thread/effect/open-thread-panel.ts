/**
 * WHAT: Opens the right-side terminal thread panel without stealing keyboard focus.
 * WHY: The first A press should leave voice shortcuts available; a second A focuses text.
 */
import { openThreadPanelController } from '../controller/open-thread-panel-controller.js';

export function openThreadPanel(): void {
  openThreadPanelController();
}
