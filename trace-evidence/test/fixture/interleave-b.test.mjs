import test from 'node:test';
test('interleave b', async () => { console.log(JSON.stringify({ telemetry: { name: 'interleave-b', args: {}, at: new Date().toISOString(), rawStack: new Error().stack } })); await new Promise((resolve) => setTimeout(resolve, 40)); });
