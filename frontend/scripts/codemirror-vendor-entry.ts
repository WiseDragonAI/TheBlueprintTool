/**
 * WHAT: Exposes the exact CodeMirror symbols consumed by the owner-neutral Markdown editor adapter.
 * WHY: A narrow vendor entry keeps the pinned local browser bundle deterministic.
 */
export { basicSetup } from 'codemirror';
export { Compartment, EditorState, Transaction } from '@codemirror/state';
export { EditorView, keymap } from '@codemirror/view';
export { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
export { markdown } from '@codemirror/lang-markdown';
export { defaultKeymap, historyKeymap, redo, undo } from '@codemirror/commands';
export { openSearchPanel, searchKeymap } from '@codemirror/search';
export { tags } from '@lezer/highlight';
