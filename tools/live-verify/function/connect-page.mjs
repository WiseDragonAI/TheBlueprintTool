import { createCdpSender } from './create-cdp-sender.mjs';

export async function connectPage(cdpJsonUrl) {
  const targets = await fetch(cdpJsonUrl).then((response) => response.json());
  const page = targets.find((target) => target.type === 'page');
  if (!page) throw new Error(`No page target found at ${cdpJsonUrl}`);
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }));
  return { socket, send: createCdpSender(socket) };
}
