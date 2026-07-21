/**
 * WHAT: Runs asynchronous materialization work in bounded turns and concurrency windows.
 * WHY: Large recovery batches must yield to HTTP work and cap simultaneous atomic writes.
 */
export async function runBoundedTaskMaterialization<T>(values: T[], action: (value: T) => Promise<void>, batchSize = 32, concurrency = 4): Promise<void> {
  for (let batchStart = 0; batchStart < values.length; batchStart += batchSize) {
    const batch = values.slice(batchStart, batchStart + batchSize);
    for (let writeStart = 0; writeStart < batch.length; writeStart += concurrency) {
      await Promise.all(batch.slice(writeStart, writeStart + concurrency).map(action));
    }
    await new Promise<void>((resolveTurn) => setImmediate(resolveTurn));
  }
}
