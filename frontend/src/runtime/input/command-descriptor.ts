/**
 * WHAT: Defines, validates, and stores canonical UI command descriptors.
 * WHY: Command identity rules must remain independent from DOM binding and execution settlement.
 */

export type CommandPendingPolicy = 'allow' | 'ignore' | 'replace';
export type CommandReconciliationPolicy = 'none' | 'rollback' | 'confirmed-state';

export type CommandDescriptor = Readonly<{
  commandId: string;
  stateOwner: string;
  transitionOwner: string;
  resourceIdentity: string;
  presentationGeneration: number;
  pendingPolicy: CommandPendingPolicy;
  reconciliationPolicy: CommandReconciliationPolicy;
  keyboardBinding: string;
}>;

export type CommandDefinition = Readonly<{
  commandId: string;
  stateOwner: string;
  transitionOwner: string;
  pendingPolicy: CommandPendingPolicy;
  reconciliationPolicy: CommandReconciliationPolicy;
  keyboardBinding: string;
}>;

export type CommandDescriptorInput = {
  commandId: string;
  stateOwner: string;
  transitionOwner: string;
  resourceIdentity?: string;
  presentationGeneration?: number;
  pendingPolicy?: CommandPendingPolicy;
  reconciliationPolicy?: CommandReconciliationPolicy;
  keyboardBinding?: string;
};

const definitions = new Map<string, CommandDefinition>();

function requiredString(value: unknown, field: string): string {
  const normalized = String(value ?? '').trim();
  // WHAT: Reject descriptors whose required owner identity is absent.
  // WHY: Empty identities make ownership conflicts and diagnostics ambiguous.
  if (!normalized) throw new Error(`Command ownership requires ${field}.`);
  return normalized;
}

function definitionFromDescriptor(descriptor: CommandDescriptor): CommandDefinition {
  return Object.freeze({
    commandId: descriptor.commandId,
    stateOwner: descriptor.stateOwner,
    transitionOwner: descriptor.transitionOwner,
    pendingPolicy: descriptor.pendingPolicy,
    reconciliationPolicy: descriptor.reconciliationPolicy,
    keyboardBinding: descriptor.keyboardBinding,
  });
}

function assertDefinitionParity(existing: CommandDefinition, next: CommandDefinition): void {
  for (const field of ['stateOwner', 'transitionOwner', 'pendingPolicy', 'reconciliationPolicy', 'keyboardBinding'] as const) {
    // WHAT: Reject a second declaration that changes canonical command ownership.
    // WHY: Every command family must resolve to one state and transition owner.
    if (existing[field] !== next[field]) {
      throw new Error(`Command ${next.commandId} has competing ${field} owners (${existing[field]} and ${next[field]}).`);
    }
  }
}

export function createCommandDescriptor(input: CommandDescriptorInput): CommandDescriptor {
  const pendingPolicy = input.pendingPolicy ?? 'allow';
  // WHAT: Limit pending behavior to policies understood by the dispatcher.
  // WHY: An unknown policy would make duplicate execution behavior undefined.
  if (!['allow', 'ignore', 'replace'].includes(pendingPolicy)) throw new Error(`Unknown pending policy: ${pendingPolicy}`);
  const reconciliationPolicy = input.reconciliationPolicy ?? 'none';
  // WHAT: Limit reconciliation behavior to the declared command contract.
  // WHY: Callers need a stable terminal-state vocabulary.
  if (!['none', 'rollback', 'confirmed-state'].includes(reconciliationPolicy)) throw new Error(`Unknown reconciliation policy: ${reconciliationPolicy}`);
  const presentationGeneration = Number(input.presentationGeneration ?? 0);
  // WHAT: Reject invalid presentation generations before registration.
  // WHY: Stale-completion comparison requires a finite monotonic value.
  if (!Number.isFinite(presentationGeneration) || presentationGeneration < 0) {
    throw new Error('Command ownership requires a non-negative presentationGeneration.');
  }
  return Object.freeze({
    commandId: requiredString(input.commandId, 'commandId'),
    stateOwner: requiredString(input.stateOwner, 'stateOwner'),
    transitionOwner: requiredString(input.transitionOwner, 'transitionOwner'),
    resourceIdentity: String(input.resourceIdentity ?? ''),
    presentationGeneration,
    pendingPolicy,
    reconciliationPolicy,
    keyboardBinding: String(input.keyboardBinding ?? '').trim(),
  });
}

/** Register one canonical owner for a command family. Repeated matching declarations are idempotent. */
export function registerCommandDescriptor(input: CommandDescriptorInput | CommandDescriptor): CommandDescriptor {
  const descriptor = createCommandDescriptor(input);
  const definition = definitionFromDescriptor(descriptor);
  const existing = definitions.get(descriptor.commandId);
  // WHAT: Validate repeated declarations and store only the first canonical definition.
  // WHY: Resource and presentation identity may vary while ownership policy must remain stable.
  if (existing) assertDefinitionParity(existing, definition);
  else definitions.set(descriptor.commandId, definition);
  return descriptor;
}

export function commandDescriptor(commandId: string, identity: { resourceIdentity?: string; presentationGeneration?: number } = {}): CommandDescriptor {
  const definition = definitions.get(commandId);
  // WHAT: Reject dispatch against a command that has no registered owner.
  // WHY: Silent fallback would bypass the ownership contract.
  if (!definition) throw new Error(`Unknown command: ${commandId}`);
  return createCommandDescriptor({ ...definition, ...identity });
}

export function registeredCommandDefinitions(): ReadonlyArray<CommandDefinition> {
  return Object.freeze([...definitions.values()].map((definition) => Object.freeze({ ...definition })));
}

export function hasRegisteredCommandDefinition(commandId: string): boolean {
  return definitions.has(commandId);
}
