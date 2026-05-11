export function browserWaitFrame() {
  return new Promise(function browserResolveFrame(resolve) { setTimeout(resolve, 260); });
}
