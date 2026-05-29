export function isGestureControlTarget(target: EventTarget | null): boolean {
  return Boolean((target as HTMLElement | null)?.closest?.('button,input,textarea,select,[data-action],[data-wheel-capture],[contenteditable="true"]'));
}
