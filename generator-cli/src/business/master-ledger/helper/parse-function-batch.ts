/**
 * WHAT: MasterLedger function and suite parser.
 * WHY: generator-cli must turn ledger sections into GeneratedFunction and test suite records.
 */
import type { FunctionKind, GeneratedFunction, MasterLedgerDocument, TestSuitePlan } from '../../../lib/types.js';
import { dashToCamel, hash8, safeSegment } from '../../../lib/name.js';

export type FunctionBatch = {
  functions: GeneratedFunction[];
  suites: TestSuitePlan[];
};

function section(text: string, start: string, end: string): string {
  const startIndex = text.indexOf(start);
  const endIndex = text.indexOf(end, startIndex + start.length);

  // WHY: a missing section means the batch cannot supply that group.
  // WHAT: return an empty section for downstream validation.
  if (startIndex === -1) {
    return '';
  }

  return text.slice(startIndex, endIndex === -1 ? undefined : endIndex);
}

function headingSection(text: string, start: RegExp, end: RegExp): string {
  const startMatch = start.exec(text);

  if (!startMatch || startMatch.index === undefined) {
    return '';
  }

  end.lastIndex = startMatch.index + startMatch[0].length;
  const endMatch = end.exec(text);
  return text.slice(startMatch.index, endMatch?.index);
}

function rootBlocksFor(text: string): string[] {
  return [...new Set([...text.matchAll(/root_block: '([^']+)'/g)].map((match) => match[1]))];
}

function domainFor(rootBlock: string, name: string, controlSection: string): string {
  const objectRegex = /\{\s*root_block: '([^']+)',[\s\S]*?domain: '([^']+)'[\s\S]*?\n\s*\}/g;
  let match: RegExpExecArray | null;

  while ((match = objectRegex.exec(controlSection)) !== null) {
    const [, candidateRootBlock, domain] = match;
    const objectText = match[0];
    const helperList = objectText.match(/helpers: \[([^\]]*)\]/)?.[1] ?? '';
    const effectList = objectText.match(/effects: \[([^\]]*)\]/)?.[1] ?? '';
    const list = `${helperList},${effectList}`;

    // WHY: helper and effect ownership is defined by the controller using it.
    // WHAT: return the first domain that references the function name.
    if (candidateRootBlock === rootBlock && list.includes(`'${name}'`)) {
      return domain;
    }
  }

  return 'telemetry';
}

function exportNameFor(kind: FunctionKind, name: string, body: string): string {
  if (kind === 'controller') {
    return body.match(/async function\s+([A-Za-z0-9_]+)/)?.[1] ?? dashToCamel(name);
  }

  return dashToCamel(name);
}

function toGeneratedFunction(rootBlock: string, kind: FunctionKind, domain: string, name: string, description: string, body = '', returnType?: string): GeneratedFunction {
  return {
    functionId: hash8(`${rootBlock}:${kind}:${domain}:${name}`),
    rootBlock,
    kind,
    domain,
    name,
    exportName: exportNameFor(kind, name, body),
    path: `${rootBlock}/src/business/${domain}/${kind}/${name}.ts`,
    sourceSpecIds: [],
    telemetryName: name,
    description,
    returnType,
    body,
    pure: kind === 'helper',
    componentOutput: kind === 'component',
  };
}

export function parseFunctionBatch(document: MasterLedgerDocument): FunctionBatch {
  const helperSection = headingSection(document.text, /^## E\.[^\n]*Effects[^\n]*Helpers[^\n]*$/im, /^## F\./gim) || section(document.text, '## E. Effects And I/O Helpers', '## F.');
  const controlSection = headingSection(document.text, /^## I\.[^\n]*Control-Flow Entries[^\n]*$/im, /^## J\./gim) || section(document.text, '## I. Control-Flow Entries', '## J.');
  const suiteSection = headingSection(document.text, /^## B\.[^\n]*Test Suites[^\n]*$/im, /^## C\./gim) || section(document.text, '## B. Test Suites', '## C.');
  const defaultRootBlock = rootBlocksFor(document.text)[0] ?? 'generator-cli';
  const functions = new Map<string, GeneratedFunction>();
  const itemRegex = /\{\s*type: '(helper|effect)'[\s\S]*?name: '([^']+)'[\s\S]*?description: '([^']*)'(?:,\s*return_type: '([^']+)')?[\s\S]*?\}/g;
  let itemMatch: RegExpExecArray | null;

  while ((itemMatch = itemRegex.exec(helperSection)) !== null) {
    const [, rawKind, name, description, returnType] = itemMatch;
    const kind = rawKind as FunctionKind;
    const objectText = itemMatch[0];
    const rootBlock = objectText.match(/root_block: '([^']+)'/)?.[1] ?? defaultRootBlock;
    const domain = objectText.match(/domain: '([^']+)'/)?.[1] ?? domainFor(rootBlock, name, controlSection);
    functions.set(`${kind}:${name}`, toGeneratedFunction(rootBlock, kind, domain, name, description, '', returnType));
  }

  const controllerRegex = /\{\s*root_block: '([^']+)',[\s\S]*?domain: '([^']+)'[\s\S]*?controller: '([^']+)'[\s\S]*?description: '([^']*)'[\s\S]*?pseudoCode: `([\s\S]*?)`\s*\n\s*\}/g;
  let controllerMatch: RegExpExecArray | null;

  while ((controllerMatch = controllerRegex.exec(controlSection)) !== null) {
    const [, rootBlock, domain, name, description, body] = controllerMatch;
    functions.set(`controller:${name}`, toGeneratedFunction(rootBlock, 'controller', domain, name, description, body));
  }

  const suiteRegex = /suite_name: '([^']+)'[\s\S]*?spec_id: '([^']+)'[\s\S]*?root_block: '([^']+)'[\s\S]*?path: '([^']+)'[\s\S]*?expected_telemetry: \[([^\]]*)\]/g;
  const suites: TestSuitePlan[] = [];
  let suiteMatch: RegExpExecArray | null;

  while ((suiteMatch = suiteRegex.exec(suiteSection)) !== null) {
    const [, suiteName, specId, rootBlock, path, expectedRaw] = suiteMatch;
    suites.push({
      suiteName,
      specId,
      rootBlock,
      path,
      expectedTelemetry: [...expectedRaw.matchAll(/'([^']+)'/g)].map((match) => match[1]),
    });
  }

  const explicitComponentRegex = /kind:\s*['"]component['"][\s\S]*?name:\s*['"]([^'"]+)['"]/g;
  let componentMatch: RegExpExecArray | null;

  while ((componentMatch = explicitComponentRegex.exec(document.text)) !== null) {
    const name = safeSegment(componentMatch[1]);
    functions.set(`component:${name}`, toGeneratedFunction(defaultRootBlock, 'component', 'generate', name, 'Generated component function render output.'));
  }

  return { functions: [...functions.values()], suites };
}
