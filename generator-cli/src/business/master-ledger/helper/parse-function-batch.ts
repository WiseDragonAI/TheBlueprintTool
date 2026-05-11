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

function domainFor(name: string, controlSection: string): string {
  const objectRegex = /\{\s*root_block: 'generator-cli',[\s\S]*?domain: '([^']+)'[\s\S]*?\n\s*\}/g;
  let match: RegExpExecArray | null;

  while ((match = objectRegex.exec(controlSection)) !== null) {
    const [, domain] = match;
    const objectText = match[0];
    const helperList = objectText.match(/helpers: \[([^\]]*)\]/)?.[1] ?? '';
    const effectList = objectText.match(/effects: \[([^\]]*)\]/)?.[1] ?? '';
    const list = `${helperList},${effectList}`;

    // WHY: helper and effect ownership is defined by the controller using it.
    // WHAT: return the first domain that references the function name.
    if (list.includes(`'${name}'`)) {
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

function toGeneratedFunction(kind: FunctionKind, domain: string, name: string, description: string, body = '', returnType?: string): GeneratedFunction {
  return {
    functionId: hash8(`${kind}:${domain}:${name}`),
    kind,
    domain,
    name,
    exportName: exportNameFor(kind, name, body),
    path: `src/business/${domain}/${kind}/${name}.ts`,
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
  const helperSection = section(document.text, '## E. Effects And I/O Helpers', '## F.');
  const controlSection = section(document.text, '## I. Control-Flow Entries', '## J.');
  const suiteSection = section(document.text, '## B. Test Suites', '## C.');
  const functions = new Map<string, GeneratedFunction>();
  const itemRegex = /\{\s*type: '(helper|effect)'[\s\S]*?name: '([^']+)'[\s\S]*?description: '([^']*)'(?:,\s*return_type: '([^']+)')?[\s\S]*?\n\s*\}/g;
  let itemMatch: RegExpExecArray | null;

  while ((itemMatch = itemRegex.exec(helperSection)) !== null) {
    const [, rawKind, name, description, returnType] = itemMatch;
    const kind = rawKind as FunctionKind;
    const domain = domainFor(name, controlSection);
    functions.set(`${kind}:${name}`, toGeneratedFunction(kind, domain, name, description, '', returnType));
  }

  const controllerRegex = /\{\s*root_block: 'generator-cli',[\s\S]*?domain: '([^']+)'[\s\S]*?controller: '([^']+)'[\s\S]*?description: '([^']*)'[\s\S]*?pseudoCode: `([\s\S]*?)`\s*\n\s*\}/g;
  let controllerMatch: RegExpExecArray | null;

  while ((controllerMatch = controllerRegex.exec(controlSection)) !== null) {
    const [, domain, name, description, body] = controllerMatch;
    functions.set(`controller:${name}`, toGeneratedFunction('controller', domain, name, description, body));
  }

  const suiteRegex = /suite_name: '([^']+)'[\s\S]*?spec_id: '([^']+)'[\s\S]*?path: '([^']+)'[\s\S]*?expected_telemetry: \[([^\]]*)\]/g;
  const suites: TestSuitePlan[] = [];
  let suiteMatch: RegExpExecArray | null;

  while ((suiteMatch = suiteRegex.exec(suiteSection)) !== null) {
    const [, suiteName, specId, path, expectedRaw] = suiteMatch;
    suites.push({
      suiteName,
      specId,
      path,
      expectedTelemetry: [...expectedRaw.matchAll(/'([^']+)'/g)].map((match) => match[1]),
    });
  }

  const explicitComponentRegex = /kind:\s*['"]component['"][\s\S]*?name:\s*['"]([^'"]+)['"]/g;
  let componentMatch: RegExpExecArray | null;

  while ((componentMatch = explicitComponentRegex.exec(document.text)) !== null) {
    const name = safeSegment(componentMatch[1]);
    functions.set(`component:${name}`, toGeneratedFunction('component', 'generate', name, 'Generated component function render output.'));
  }

  return { functions: [...functions.values()], suites };
}
