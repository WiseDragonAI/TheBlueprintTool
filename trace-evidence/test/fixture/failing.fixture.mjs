import test from 'node:test';
test('intentional selected failure', () => { throw new Error('intentional trace fixture failure'); });
