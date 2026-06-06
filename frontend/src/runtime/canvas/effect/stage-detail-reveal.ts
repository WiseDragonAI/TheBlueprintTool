/**
 * WHAT: Re-exports the staged detail reveal edge scheduler API.
 * WHY: Existing canvas callers import this module while implementation files stay one function per file.
 */
export { beginStagedDetailReveal } from './staged-detail-reveal/begin-staged-detail-reveal.js';
export { cancelStagedDetailReveal } from './staged-detail-reveal/cancel-staged-detail-reveal.js';
export { scheduleStagedDetailReveal } from './staged-detail-reveal/schedule-staged-detail-reveal.js';
