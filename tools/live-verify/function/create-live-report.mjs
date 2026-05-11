import { connectPage } from './connect-page.mjs';
import { readLiveAppState } from './read-live-app-state.mjs';

export async function createLiveReport(url, cdpJsonUrl) {
  const { socket, send } = await connectPage(cdpJsonUrl);
  try {
    return await readLiveAppState(send, url);
  } finally {
    socket.close();
  }
}
