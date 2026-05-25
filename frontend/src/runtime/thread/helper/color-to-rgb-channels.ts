/**
 * WHAT: Converts a CSS rgb or hex color into comma-separated RGB channels.
 * WHY: Thread accent colors drive rgba() based terminal variables.
 */
export function colorToRgbChannels(color: string): string | null {
  const trimmed = color.trim();
  const rgb = trimmed.match(/rgba?\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)/);
  if (rgb) return `${Math.round(Number(rgb[1]))}, ${Math.round(Number(rgb[2]))}, ${Math.round(Number(rgb[3]))}`;
  const hex = trimmed.replace(/^#/, '');
  if (!/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(hex)) return null;
  const normalized = hex.length === 3 ? hex.split('').map((channel) => `${channel}${channel}`).join('') : hex;
  return `${Number.parseInt(normalized.slice(0, 2), 16)}, ${Number.parseInt(normalized.slice(2, 4), 16)}, ${Number.parseInt(normalized.slice(4, 6), 16)}`;
}
