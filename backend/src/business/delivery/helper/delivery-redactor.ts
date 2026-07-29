/**
 * WHAT: Redacts delivery diagnostics through one bounded recursive boundary.
 * WHY: Credentials, physical paths, command lines, and raw child output must never enter delivery JSON or incidents.
 */
import { redactDeliveryText } from '../../../../../shared/schemas/decision-os-delivery-types.js';

export { redactDeliveryText };

export function redactDeliverySecret(value: unknown, secret: string): string {
  const text = String(value ?? '');
  return (secret ? text.replaceAll(secret, '[REDACTED]') : text)
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+/gi, 'Bearer [REDACTED]')
    .replace(/CLOUDFLARE_API_TOKEN\s*[:=]\s*\S+/gi, 'CLOUDFLARE_API_TOKEN=[REDACTED]');
}

export function redactDeliveryValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[REDACTED_DEPTH]';
  if (typeof value === 'string') return redactDeliveryText(value);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.slice(0, 128).map((entry) => redactDeliveryValue(entry, depth + 1));
  if (typeof value !== 'object') return redactDeliveryText(value);
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>).slice(0, 128)) {
    if (/(?:authorization|cookie|credential|secret|token|password|private.?key|argv|arguments|stdout|stderr|output|path|file|root|command)/i.test(key)) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = redactDeliveryValue(entry, depth + 1);
    }
  }
  return result;
}

export function redactDeliveryError(error: unknown): Error & { code?: string } {
  const source = error instanceof Error ? error : new Error(String(error));
  const redacted: Error & { code?: string } = new Error(redactDeliveryText(source.message));
  redacted.name = source.name;
  redacted.stack = source.stack ? redactDeliveryText(source.stack, 16_000) : undefined;
  if (error && typeof error === 'object' && 'code' in error) {
    redacted.code = redactDeliveryText((error as { code?: unknown }).code, 240);
  }
  return redacted;
}
