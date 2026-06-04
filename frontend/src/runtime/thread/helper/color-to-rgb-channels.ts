/**
 * WHAT: Converts a CSS rgb or hex color into comma-separated RGB channels.
 * WHY: Thread accent colors drive rgba() based terminal variables.
 */
export function colorToRgbChannels(color: string): string | null {
  const channels = colorToRgb(color);
  return channels ? `${channels.r}, ${channels.g}, ${channels.b}` : null;
}

function colorToRgb(color: string): { r: number; g: number; b: number } | null {
  const trimmed = color.trim();
  const rgb = trimmed.match(/rgba?\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)/);
  if (rgb) {
    return {
      r: Math.round(Number(rgb[1])),
      g: Math.round(Number(rgb[2])),
      b: Math.round(Number(rgb[3])),
    };
  }
  const hex = trimmed.replace(/^#/, '');
  if (!/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(hex)) return null;
  const normalized = hex.length === 3 ? hex.split('').map((channel) => `${channel}${channel}`).join('') : hex;
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

export function lightenColorInHsv(color: string, valueLift = 0.34): string | null {
  const rgb = colorToRgb(color);
  if (!rgb) return null;
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const hue = delta === 0
    ? 0
    : max === r
      ? ((g - b) / delta + (g < b ? 6 : 0)) / 6
      : max === g
        ? ((b - r) / delta + 2) / 6
        : ((r - g) / delta + 4) / 6;
  const saturation = max === 0 ? 0 : delta / max;
  const value = Math.min(1, max + valueLift);
  const chroma = value * saturation;
  const hueSector = hue * 6;
  const x = chroma * (1 - Math.abs((hueSector % 2) - 1));
  const m = value - chroma;
  const [rr, gg, bb] = hueSector < 1
    ? [chroma, x, 0]
    : hueSector < 2
      ? [x, chroma, 0]
      : hueSector < 3
        ? [0, chroma, x]
        : hueSector < 4
          ? [0, x, chroma]
          : hueSector < 5
            ? [x, 0, chroma]
            : [chroma, 0, x];
  return `rgb(${Math.round((rr + m) * 255)}, ${Math.round((gg + m) * 255)}, ${Math.round((bb + m) * 255)})`;
}
