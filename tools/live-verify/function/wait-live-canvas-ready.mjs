export async function waitLiveCanvasReady(send) {
  await send('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `new Promise(function waitLiveCanvasReady(resolve) {
      function checkLiveCanvasReady() {
        if (document.querySelector('.grid') && document.querySelector('.canvas') && window.__coreState) {
          resolve(true);
          return;
        }
        setTimeout(checkLiveCanvasReady, 50);
      }
      checkLiveCanvasReady();
    })`
  });
}
