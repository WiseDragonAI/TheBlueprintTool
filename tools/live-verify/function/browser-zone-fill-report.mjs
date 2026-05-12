export function browserZoneFillReport(selector) {
  const zone = document.querySelector(selector);
  if (!zone) return { ok: false, backgroundUsesAlpha: false, borderDiffersFromFill: false };
  const style = getComputedStyle(zone);
  const background = `${style.background} ${style.backgroundImage} ${style.backgroundColor}`;
  const backgroundUsesAlpha = background.includes('transparent')
    || /rgba\([^)]*,\s*(0?\.\d+|0)\)/.test(background)
    || /\/\s*(0?\.\d+|0)\)/.test(background);
  return {
    ok: backgroundUsesAlpha && style.borderColor !== style.backgroundColor,
    backgroundUsesAlpha,
    borderDiffersFromFill: style.borderColor !== style.backgroundColor,
    borderColor: style.borderColor,
    backgroundColor: style.backgroundColor
  };
}
