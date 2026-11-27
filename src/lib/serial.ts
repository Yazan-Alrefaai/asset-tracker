/**
 * Runs an async job one at a time. A call made while the job is running is not dropped:
 * the job runs once more right after, so it always sees the newest data.
 * (Several calls during one run are merged into that single extra run.)
 */
export function serial<T>(job: () => Promise<T>): () => Promise<T> {
  let running: Promise<T> | null = null;
  let queued: Promise<T> | null = null;

  const start = (): Promise<T> => {
    running = job().finally(() => {
      running = null;
    });
    return running;
  };

  return () => {
    if (!running) return start();
    queued ??= running
      .catch(() => undefined)
      .then(() => {
        queued = null;
        return start();
      });
    return queued;
  };
}
