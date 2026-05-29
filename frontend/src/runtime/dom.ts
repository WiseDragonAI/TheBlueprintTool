const runtimeDocument = globalThis.document;

export const canvas = runtimeDocument?.querySelector('.canvas') as HTMLElement;
export const content = runtimeDocument?.querySelector('.canvas-content') as HTMLElement;
export const telemetryList = runtimeDocument?.querySelector('.telemetry-list') as HTMLOListElement;
export const modal = runtimeDocument?.querySelector('.confirm-modal') as HTMLDialogElement;
export const shortcutModal = runtimeDocument?.querySelector('.shortcut-modal') as HTMLDialogElement;
export const runbookModal = runtimeDocument?.querySelector('.runbook-modal') as HTMLDialogElement;
export const SVG_NS = 'http://www.w3.org/2000/svg';
