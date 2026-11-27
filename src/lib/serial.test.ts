import { describe, expect, it } from 'vitest';
import { serial } from './serial';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

describe('serial', () => {
  it('runs once more when called during a run, instead of dropping the call', async () => {
    const gates = [deferred(), deferred()];
    let runs = 0;
    const job = serial(async () => {
      const n = runs++;
      await gates[n].promise;
      return n;
    });

    const first = job();
    const second = job(); // arrives while the first run is busy
    const third = job(); // merged with the second
    expect(runs).toBe(1);

    gates[0].resolve();
    expect(await first).toBe(0);
    gates[1].resolve();
    expect(await second).toBe(1);
    expect(await third).toBe(1);
    expect(runs).toBe(2);
  });

  it('keeps working after a run fails', async () => {
    let n = 0;
    const job = serial(async () => {
      n++;
      if (n === 1) throw new Error('boom');
      return n;
    });
    await expect(job()).rejects.toThrow('boom');
    expect(await job()).toBe(2);
  });

  it('starts a fresh run when nothing is running', async () => {
    let n = 0;
    const job = serial(async () => ++n);
    expect(await job()).toBe(1);
    expect(await job()).toBe(2);
  });
});
