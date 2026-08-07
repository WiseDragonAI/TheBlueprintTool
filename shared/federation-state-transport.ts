/**
 * WHAT: Defines the shared count and byte ceilings for one epoch-4 state transaction.
 * WHY: Nodes and relays must emit and admit the same bounded unit of durable repair work.
 */
export const federationStateEntityBatchSize = 16;
export const federationMaximumStateFrameBytes = 512 * 1024;
