/**
 * WHAT: Resolves card and zone-derived readable accent colors.
 * WHY: Markdown code and relationship labels must preserve hue without forcing neon brightness.
 */
import { elementCanvasRect } from '../../canvas/helper/element-canvas-rect.js';
import { rectanglesIntersect } from '../../canvas/helper/rectangles-intersect.js';

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

type HsvColor = {
  h: number;
  s: number;
  v: number;
};

const CODE_COLOR_VALUE = 0.85;
const MIN_READABLE_LUMINANCE = 0.46;

function parseHexColor(color: string): RgbColor | null {
  const hex = color.trim().replace(/^#/, '');
  if (!/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(hex)) return null;
  const normalized = hex.length === 3
    ? hex.split('').map((value) => `${value}${value}`).join('')
    : hex;
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16)
  };
}

function parseRgbColor(color: string): RgbColor | null {
  const match = color.trim().match(/^rgba?\(([^)]+)\)$/i);
  if (!match) return null;
  const [r, g, b] = match[1].split(',').slice(0, 3).map((value) => Number.parseFloat(value.trim()));
  if ([r, g, b].some((value) => !Number.isFinite(value))) return null;
  return {
    r: Math.min(255, Math.max(0, Math.round(r))),
    g: Math.min(255, Math.max(0, Math.round(g))),
    b: Math.min(255, Math.max(0, Math.round(b)))
  };
}

function parseColor(color: string): RgbColor | null {
  return parseHexColor(color) ?? parseRgbColor(color);
}

function channelToHex(value: number): string {
  return Math.min(255, Math.max(0, Math.round(value))).toString(16).padStart(2, '0');
}

function rgbToHsv({ r, g, b }: RgbColor): HsvColor {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let h = 0;
  if (delta > 0 && max === red) h = 60 * (((green - blue) / delta) % 6);
  else if (delta > 0 && max === green) h = 60 * ((blue - red) / delta + 2);
  else if (delta > 0) h = 60 * ((red - green) / delta + 4);
  return {
    h: h < 0 ? h + 360 : h,
    s: max === 0 ? 0 : delta / max,
    v: max
  };
}

function hsvToRgb({ h, s, v }: HsvColor): RgbColor {
  const chroma = v * s;
  const x = chroma * (1 - Math.abs((h / 60) % 2 - 1));
  const m = v - chroma;
  const [red, green, blue] =
    h < 60 ? [chroma, x, 0]
      : h < 120 ? [x, chroma, 0]
        : h < 180 ? [0, chroma, x]
          : h < 240 ? [0, x, chroma]
            : h < 300 ? [x, 0, chroma]
              : [chroma, 0, x];
  return {
    r: (red + m) * 255,
    g: (green + m) * 255,
    b: (blue + m) * 255
  };
}

function relativeLuminance({ r, g, b }: RgbColor): number {
  return 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
}

function rgbToHex(rgb: RgbColor): string {
  return `#${channelToHex(rgb.r)}${channelToHex(rgb.g)}${channelToHex(rgb.b)}`;
}

export function clampReadableHsvColor(color: string): string | null {
  const rgb = parseColor(color);
  if (!rgb) return null;
  const hsv = rgbToHsv(rgb);
  hsv.v = CODE_COLOR_VALUE;
  let readable = hsvToRgb(hsv);
  while (relativeLuminance(readable) < MIN_READABLE_LUMINANCE && hsv.s > 0) {
    hsv.s = Math.max(0, hsv.s - 0.02);
    readable = hsvToRgb(hsv);
  }
  return rgbToHex(readable);
}

export function clampCardCodeColor(color: string): string | null {
  return clampReadableHsvColor(color);
}

function setReadableZoneColor(zone: HTMLElement): string | null {
  const zoneColor = getComputedStyle(zone).getPropertyValue('--zone-color').trim();
  const readableColor = clampReadableHsvColor(zoneColor);
  if (readableColor) zone.style.setProperty('--zone-readable-color', readableColor);
  else zone.style.removeProperty('--zone-readable-color');
  return readableColor;
}

export function renderCardZoneColors(): void {
  const zones = Array.from(document.querySelectorAll('.regular-zone[data-zone-id]')) as HTMLElement[];
  for (const zone of zones) setReadableZoneColor(zone);
  for (const card of Array.from(document.querySelectorAll('[data-card-id]')) as HTMLElement[]) {
    const ledgerZoneId = card.dataset.cardZoneId ?? '';
    const ledgerZoneColor = card.dataset.cardZoneColor ?? '';
    card.style.removeProperty('--card-zone-color');
    card.style.removeProperty('--card-code-color');
    card.style.removeProperty('--card-readable-color');
    const ledgerZone = ledgerZoneId
      ? zones.find((zone) => zone.dataset.zoneId === ledgerZoneId)
      : null;
    if (ledgerZone || ledgerZoneColor) {
      const zoneColor = ledgerZone
        ? getComputedStyle(ledgerZone).getPropertyValue('--zone-color').trim()
        : ledgerZoneColor;
      card.style.setProperty('--card-zone-color', zoneColor);
      card.dataset.cardZoneColor = zoneColor;
      const readableColor = ledgerZone ? setReadableZoneColor(ledgerZone) : clampReadableHsvColor(zoneColor);
      if (readableColor) {
        card.style.setProperty('--card-code-color', readableColor);
        card.style.setProperty('--card-readable-color', readableColor);
      }
      continue;
    }
    const cardRect = elementCanvasRect(card);
    for (const zone of zones) {
      if (!rectanglesIntersect(cardRect, elementCanvasRect(zone))) continue;
      const zoneColor = getComputedStyle(zone).getPropertyValue('--zone-color').trim();
      card.style.setProperty('--card-zone-color', zoneColor);
      const readableColor = setReadableZoneColor(zone);
      if (readableColor) {
        card.style.setProperty('--card-code-color', readableColor);
        card.style.setProperty('--card-readable-color', readableColor);
      }
      break;
    }
  }
}
