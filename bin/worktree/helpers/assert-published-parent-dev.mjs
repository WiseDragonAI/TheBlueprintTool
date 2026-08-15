/**
 * WHAT: Loads and admits the currently published canonical parent dev state.
 * WHY: Integration needs fresh remote evidence before every child-source mutation boundary.
 */
import { devRoot } from '../config.mjs';
import { assertCanonicalDevRegistration } from './assert-canonical-dev-registration.mjs';
import { admitPublishedParentDev } from './admit-published-parent-dev.mjs';
import { git } from './git.mjs';
import { gitText } from './git-text.mjs';

export function assertPublishedParentDev() {
  assertCanonicalDevRegistration();
  git(devRoot, ['fetch', 'origin', 'dev'], { timeout: 180_000 });
  const devSha = gitText(devRoot, ['rev-parse', 'HEAD^{commit}']);
  const publishedDevSha = gitText(devRoot, ['rev-parse', 'origin/dev^{commit}']);
  return admitPublishedParentDev({
    devSha,
    publishedDevSha,
    decisionOsGitlink: gitText(devRoot, ['rev-parse', `${devSha}:.decision-os`]),
  });
}
