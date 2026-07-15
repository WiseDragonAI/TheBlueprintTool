function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value) || 0));
}

function normalizedHue(value) {
  return ((Number(value) % 360) + 360) % 360;
}

function channelHex(value) {
  return Math.round(clamp(value, 0, 1) * 255).toString(16).padStart(2, '0');
}

export function hsvToHex({ hue, saturation, value }) {
  const normalized = normalizedHue(hue);
  const saturationRatio = clamp(saturation, 0, 100) / 100;
  const valueRatio = clamp(value, 0, 100) / 100;
  const sector = normalized / 60;
  const chroma = valueRatio * saturationRatio;
  const secondary = chroma * (1 - Math.abs((sector % 2) - 1));
  const offset = valueRatio - chroma;
  const [red, green, blue] = sector < 1
    ? [chroma, secondary, 0]
    : sector < 2
      ? [secondary, chroma, 0]
      : sector < 3
        ? [0, chroma, secondary]
        : sector < 4
          ? [0, secondary, chroma]
          : sector < 5
            ? [secondary, 0, chroma]
            : [chroma, 0, secondary];
  return `#${channelHex(red + offset)}${channelHex(green + offset)}${channelHex(blue + offset)}`;
}

export function hexToHsv(hex) {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex));
  if (!match) return { hue: 0, saturation: 70, value: 80 };
  const [red, green, blue] = match.slice(1).map((channel) => Number.parseInt(channel, 16) / 255);
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  let hue = 0;
  if (delta && maximum === red) hue = 60 * (((green - blue) / delta) % 6);
  else if (delta && maximum === green) hue = 60 * (((blue - red) / delta) + 2);
  else if (delta) hue = 60 * (((red - green) / delta) + 4);
  return {
    hue: normalizedHue(hue),
    saturation: maximum ? (delta / maximum) * 100 : 0,
    value: maximum * 100,
  };
}

export function projectColorPickerGradients(hsv) {
  const hueStops = Array.from({ length: 7 }, (_, index) => {
    const hue = index * 60;
    return `${hsvToHex({ hue, saturation: hsv.saturation, value: hsv.value })} ${index * 100 / 6}%`;
  });
  const saturated = hsvToHex({ hue: hsv.hue, saturation: 100, value: hsv.value });
  const unsaturated = hsvToHex({ hue: hsv.hue, saturation: 0, value: hsv.value });
  const fullValue = hsvToHex({ hue: hsv.hue, saturation: hsv.saturation, value: 100 });
  return {
    hue: `linear-gradient(90deg, ${hueStops.join(', ')})`,
    saturation: `linear-gradient(90deg, ${unsaturated}, ${saturated})`,
    value: `linear-gradient(90deg, #000000, ${fullValue})`,
  };
}

export function committedProjectColor(original, hsv, dirty) {
  return dirty ? hsvToHex(hsv) : original;
}
