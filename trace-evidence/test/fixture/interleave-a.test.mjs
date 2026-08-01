import test from 'node:test';
test('interleave a', async () => { await new Promise((resolve) => setTimeout(resolve, 20)); console.log(JSON.stringify({ telemetry: { name: 'interleave-a', args: {}, at: new Date().toISOString(), rawStack: new Error().stack } })); });
