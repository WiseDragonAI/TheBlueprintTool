export function browserZoneFillReport(selector) {
  const zone = document.querySelector(selector);
  if (!zone) return { ok: false, backgroundUsesAlpha: false, borderDiffersFromFill: false, backgroundAlpha: 0 };
  const style = getComputedStyle(zone);
  const background = `${style.background} ${style.backgroundImage} ${style.backgroundColor}`;
  const alphaMatch = style.backgroundColor.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([0-9.]+)\)/);
  const backgroundAlpha = alphaMatch ? Number(alphaMatch[1]) : 1;
  const backgroundUsesAlpha = background.includes('transparent')
    || /rgba\([^)]*,\s*(0?\.\d+|0)\)/.test(background)
    || /\/\s*(0?\.\d+|0)\)/.test(background);
  return {
    ok: backgroundUsesAlpha && backgroundAlpha >= 0.55 && backgroundAlpha < 1 && style.borderColor !== style.backgroundColor,
    backgroundUsesAlpha,
    backgroundAlpha,
    borderDiffersFromFill: style.borderColor !== style.backgroundColor,
    borderColor: style.borderColor,
    backgroundColor: style.backgroundColor
  };
}
