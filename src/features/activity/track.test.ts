import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { pollEvery } from './track';

// the real react-query, which sets no timer when it thinks it runs on a server: this file runs under a stand-in window
const tab = vi.hoisted(() => {
  const state = { hidden: false };
  Object.assign(globalThis, { window: globalThis, document: { get visibilityState() { return state.hidden ? 'hidden' : 'visible'; } } });
  return state;
});

describe('pollEvery', () => {
  it('asks every 2 s for a minute, then every 10 s, and stops at an end', () => {
    expect(pollEvery(undefined, 0)).toBe(2_000);
    expect(pollEvery({ outcome: 'pending' }, 59_999)).toBe(2_000);
    expect(pollEvery({ outcome: 'pending' }, 60_000)).toBe(10_000);
    expect(pollEvery({ outcome: 'delivered' }, 0)).toBe(false);
  });
});

describe('a tab left and come back to', () => {
  afterEach(() => {
    vi.useRealTimers();
    tab.hidden = false;
  });

  it('a read that lands while the tab is hidden does not end the polling, and nothing is asked while it is hidden', async () => {
    vi.useFakeTimers();
    let reads = 0;
    const client = new QueryClient();
    const observer = new QueryObserver(client, {
      queryKey: ['steps', 'x'],
      queryFn: async () => {
        reads += 1;
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { outcome: 'pending' };
      },
      refetchInterval: (q) => pollEvery(q.state.data, 0),
    });
    const off = observer.subscribe(() => {});

    // the first read lands at 100 ms, so the second starts at 2,100 ms: at 2,150 ms it is out
    await vi.advanceTimersByTimeAsync(2_150);
    expect(reads).toBe(2);
    expect(observer.getCurrentQuery().state.fetchStatus).toBe('fetching');

    tab.hidden = true;
    await vi.advanceTimersByTimeAsync(5_000);
    expect(reads).toBe(2);

    tab.hidden = false;
    await vi.advanceTimersByTimeAsync(2_100);
    expect(reads).toBeGreaterThan(2);

    off();
    client.clear();
  });
});
