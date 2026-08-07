/**
 * WHAT: Defines and dispatches UI commands through one explicit ownership contract.
 * WHY: Buttons and keyboard shortcuts must share state, transition, pending, and reconciliation ownership.
 */

export type CommandOwnershipClass = 'delegated' | 'form' | 'component';
import {
  commandDescriptor,
  createCommandDescriptor,
  hasRegisteredCommandDefinition,
  registerCommandDescriptor,
  registeredCommandDefinitions,
  type CommandDescriptor,
  type CommandDescriptorInput,
  type CommandPendingPolicy,
  type CommandReconciliationPolicy,
} from './command-descriptor.js';

export {
  commandDescriptor,
  createCommandDescriptor,
  registerCommandDescriptor,
  registeredCommandDefinitions,
  type CommandDescriptor,
  type CommandPendingPolicy,
  type CommandReconciliationPolicy,
} from './command-descriptor.js';

export type CommandExecutionContext = Readonly<{
  descriptor: CommandDescriptor;
  source: 'click' | 'keyboard' | 'form' | 'programmatic';
  event?: Event;
  element?: HTMLElement;
}>;

export type CommandExecutor = (context: CommandExecutionContext) => unknown | Promise<unknown>;

export type CommandSettlement = Readonly<{
  commandId: string;
  status: 'succeeded' | 'failed' | 'ignored' | 'stale';
  value?: unknown;
  error?: unknown;
}>;

export type CommandBinding = Readonly<{
  descriptor: CommandDescriptor;
  ownershipClass: CommandOwnershipClass;
  execute?: CommandExecutor;
}>;

type DispatchOptions = {
  descriptor?: CommandDescriptor;
  source?: CommandExecutionContext['source'];
  event?: Event;
  element?: HTMLElement;
  execute?: CommandExecutor;
  onSuccess?: (value: unknown, context: CommandExecutionContext) => void | Promise<void>;
  onFailure?: (error: unknown, context: CommandExecutionContext) => void | Promise<void>;
};

const elementBindings = new WeakMap<HTMLElement, CommandBinding>();
const formBindings = new WeakMap<HTMLFormElement, CommandBinding>();
const pendingGenerations = new Map<string, number>();
const registrationDiagnostics: Array<Readonly<{ surface: string; commandId: string; message: string }>> = [];

function bind(
  element: HTMLElement,
  descriptorInput: CommandDescriptorInput | CommandDescriptor,
  ownershipClass: CommandOwnershipClass,
  execute?: CommandExecutor,
): CommandDescriptor {
  if (!element || typeof element !== 'object' || !('dataset' in element)) throw new Error('Command ownership requires an HTMLElement.');
  if (!['delegated', 'form', 'component'].includes(ownershipClass)) throw new Error(`Unknown command ownership class: ${ownershipClass}`);
  if (elementBindings.has(element)) throw new Error(`Button already owns command ${elementBindings.get(element)?.descriptor.commandId}.`);
  const descriptor = registerCommandDescriptor(descriptorInput);
  element.dataset.command = descriptor.commandId;
  element.dataset.commandOwner = ownershipClass;
  elementBindings.set(element, Object.freeze({ descriptor, ownershipClass, execute }));
  return descriptor;
}

export function registerCommandElement(input: {
  element: HTMLElement;
  descriptor: CommandDescriptorInput | CommandDescriptor;
  ownershipClass: CommandOwnershipClass;
  execute?: CommandExecutor;
}): CommandDescriptor {
  return bind(input.element, input.descriptor, input.ownershipClass, input.execute);
}

export function updateCommandElementDescriptor(
  element: HTMLElement,
  descriptorInput: CommandDescriptorInput | CommandDescriptor,
): CommandDescriptor {
  const binding = elementBindings.get(element);
  if (!binding) throw new Error('Cannot update an unregistered command element.');
  const descriptor = registerCommandDescriptor(descriptorInput);
  if (descriptor.commandId !== binding.descriptor.commandId) {
    throw new Error(`Cannot change command identity from ${binding.descriptor.commandId} to ${descriptor.commandId}.`);
  }
  elementBindings.set(element, Object.freeze({ ...binding, descriptor }));
  return descriptor;
}

export function registerCommandForm(input: {
  form: HTMLFormElement;
  descriptor: CommandDescriptorInput | CommandDescriptor;
  execute?: CommandExecutor;
}): CommandDescriptor {
  if (!input.form || typeof input.form !== 'object' || !('dataset' in input.form)) throw new Error('Form command ownership requires an HTMLFormElement.');
  if (formBindings.has(input.form)) throw new Error(`Form already owns command ${formBindings.get(input.form)?.descriptor.commandId}.`);
  const descriptor = registerCommandDescriptor(input.descriptor);
  input.form.dataset.commandForm = descriptor.commandId;
  formBindings.set(input.form, Object.freeze({ descriptor, ownershipClass: 'form', execute: input.execute }));
  return descriptor;
}

export function commandBindingForElement(element: HTMLElement | null): CommandBinding | null {
  return element ? elementBindings.get(element) ?? null : null;
}

export function commandBindingForForm(form: HTMLFormElement | null): CommandBinding | null {
  return form ? formBindings.get(form) ?? null : null;
}

function pendingIdentity(descriptor: CommandDescriptor): string {
  return `${descriptor.commandId}\u0000${descriptor.resourceIdentity}`;
}

/** Dispatches one command and always resolves through a terminal success, failure, ignored, or stale settlement. */
export async function dispatchCommand(commandId: string, options: DispatchOptions = {}): Promise<CommandSettlement> {
  const elementBinding = options.element ? elementBindings.get(options.element) : undefined;
  const descriptor = options.descriptor ?? elementBinding?.descriptor ?? commandDescriptor(commandId);
  if (descriptor.commandId !== commandId) throw new Error(`Command binding mismatch: expected ${commandId}, received ${descriptor.commandId}.`);
  const execute = options.execute ?? elementBinding?.execute;
  if (!execute) return Object.freeze({ commandId, status: 'failed', error: new Error(`Command ${commandId} has no executor.`) });
  const identity = pendingIdentity(descriptor);
  const activeGeneration = pendingGenerations.get(identity);
  if (descriptor.pendingPolicy === 'ignore' && activeGeneration !== undefined) {
    return Object.freeze({ commandId, status: 'ignored' });
  }
  const generation = (activeGeneration ?? 0) + 1;
  if (descriptor.pendingPolicy !== 'allow') pendingGenerations.set(identity, generation);
  const context = Object.freeze({
    descriptor,
    source: options.source ?? 'programmatic',
    event: options.event,
    element: options.element,
  });
  try {
    const value = await execute(context);
    if (descriptor.pendingPolicy === 'replace' && pendingGenerations.get(identity) !== generation) {
      return Object.freeze({ commandId, status: 'stale', value });
    }
    await options.onSuccess?.(value, context);
    return Object.freeze({ commandId, status: 'succeeded', value });
  } catch (error) {
    if (descriptor.pendingPolicy === 'replace' && pendingGenerations.get(identity) !== generation) {
      return Object.freeze({ commandId, status: 'stale', error });
    }
    try { await options.onFailure?.(error, context); }
    catch (settlementError) { console.error(`Command ${commandId} failure reconciliation failed.`, settlementError); }
    return Object.freeze({ commandId, status: 'failed', error });
  } finally {
    if (descriptor.pendingPolicy !== 'allow' && pendingGenerations.get(identity) === generation) pendingGenerations.delete(identity);
  }
}

export async function dispatchCommandForElement(element: HTMLElement, event?: Event): Promise<CommandSettlement> {
  const binding = elementBindings.get(element);
  if (!binding) return Object.freeze({ commandId: element.dataset.command ?? '', status: 'failed', error: new Error('Button has no command owner.') });
  return dispatchCommand(binding.descriptor.commandId, {
    descriptor: binding.descriptor,
    source: typeof KeyboardEvent !== 'undefined' && event instanceof KeyboardEvent
      ? 'keyboard'
      : typeof SubmitEvent !== 'undefined' && event instanceof SubmitEvent
        ? 'form'
        : 'click',
    event,
    element,
  });
}

export function containCommandRegistrationFailure(surface: string, commandId: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  registrationDiagnostics.push(Object.freeze({ surface: String(surface), commandId: String(commandId), message }));
  console.error(`Command registration failed for ${surface}:${commandId}.`, error);
}

export function tryRegisterCommandElement(input: Parameters<typeof registerCommandElement>[0] & { surface: string }): CommandDescriptor | null {
  try { return registerCommandElement(input); }
  catch (error) {
    containCommandRegistrationFailure(input.surface, input.descriptor.commandId, error);
    input.element.dataset.commandOwnershipError = 'true';
    return null;
  }
}

export function commandRegistrationDiagnostics(): ReadonlyArray<Readonly<{ surface: string; commandId: string; message: string }>> {
  return Object.freeze([...registrationDiagnostics]);
}

export function registerDeclaredCommandSurface(input: {
  root?: ParentNode;
  surface: string;
  resourceIdentity?: string;
  presentationGeneration?: number;
}): ReadonlyArray<CommandDescriptor> {
  const root = input.root ?? document;
  const registered: CommandDescriptor[] = [];
  for (const node of root.querySelectorAll('button[data-command]')) {
    const element = node as HTMLButtonElement;
    if (elementBindings.has(element)) continue;
    const commandId = String(element.dataset.command ?? '').trim();
    const ownershipClass = String(element.dataset.commandOwner ?? '') as CommandOwnershipClass;
    const commandScope = commandId.split('.', 1)[0] || input.surface;
    const descriptorInput = {
      commandId,
      stateOwner: element.dataset.commandStateOwner || `${commandScope}-state`,
      transitionOwner: element.dataset.commandTransitionOwner || `${commandScope}-transition`,
      resourceIdentity: element.dataset.commandResource || input.resourceIdentity || input.surface,
      presentationGeneration: Number(element.dataset.commandPresentationGeneration ?? input.presentationGeneration ?? 0),
      pendingPolicy: (element.dataset.commandPendingPolicy || 'allow') as CommandPendingPolicy,
      reconciliationPolicy: (element.dataset.commandReconciliationPolicy || 'none') as CommandReconciliationPolicy,
      keyboardBinding: element.getAttribute('aria-keyshortcuts') || element.dataset.commandKeyboard || '',
    };
    try {
      if (ownershipClass === 'form') {
        const form = element.closest('form');
        if (!form) throw new Error(`Form command ${commandId} is not nested in a form.`);
        if (!formBindings.has(form)) registerCommandForm({ form, descriptor: descriptorInput });
      }
      registered.push(registerCommandElement({ element, descriptor: descriptorInput, ownershipClass }));
    } catch (error) {
      containCommandRegistrationFailure(input.surface, commandId, error);
      element.dataset.commandOwnershipError = 'true';
    }
  }
  return Object.freeze(registered);
}

export function validateCommandSurface(root: ParentNode = document): ReadonlyArray<string> {
  const issues: string[] = [];
  for (const button of root.querySelectorAll('button')) {
    const commandId = String((button as HTMLElement).dataset.command ?? '').trim();
    const owner = String((button as HTMLElement).dataset.commandOwner ?? '').trim();
    if (!commandId) issues.push('Button is missing data-command.');
    if (!['delegated', 'form', 'component'].includes(owner)) issues.push(`Button ${commandId || '<unknown>'} has no valid ownership class.`);
    if (owner === 'form') {
      const form = button.closest('form');
      if (!form) issues.push(`Form command ${commandId} is not nested in a form.`);
      else if (String((form as HTMLElement).dataset.commandForm ?? '') !== commandId) issues.push(`Form command ${commandId} has no matching registered submit owner.`);
    }
    if (commandId && !hasRegisteredCommandDefinition(commandId)) issues.push(`Unknown command: ${commandId}.`);
  }
  return Object.freeze(issues);
}

export function assertCommandSurface(root: ParentNode = document): void {
  const issues = validateCommandSurface(root);
  if (issues.length) throw new Error(`Command ownership validation failed:\n${issues.join('\n')}`);
}
