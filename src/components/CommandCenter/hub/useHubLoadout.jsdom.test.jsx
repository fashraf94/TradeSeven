// @vitest-environment jsdom
//
// Command Center hub, slice S5 — the Loadout's lists reader (ruling R-S5-1:
// listWatchlists() once per mount, again after an equip and after a return from
// a sheet; never on a timer). The service is the seam: every case drives it.

import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';

const { listWatchlists } = vi.hoisted(() => ({ listWatchlists: vi.fn() }));
vi.mock('../../../services/forgeWatchlistService', () => ({ listWatchlists }));

import { useHubLoadout } from './useHubLoadout';
import { LISTS_STATUS } from './selectors/loadout';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };

const committed = (id, over = {}) => ({ watchlistId: id, name: id, status: 'committed', tickers: ['AAA'], ...over });
const draft = (id) => ({ watchlistId: id, name: id, status: 'draft', tickers: [] });

let host;
let root;
let api;
let errorSpy;

function Harness({ enabled }) {
  api = useHubLoadout({ enabled });
  return null;
}
const render = (enabled) => {
  if (!host) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  }
  act(() => { root.render(<Harness enabled={enabled} />); });
};

beforeEach(() => {
  listWatchlists.mockReset();
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  if (root) act(() => { root.unmount(); });
  host?.remove();
  host = null;
  root = null;
  api = null;
  vi.useRealTimers();
  errorSpy.mockRestore();
});

describe('useHubLoadout — when it reads', () => {
  it('reads nothing while disabled (no hub data handed in, or no agent yet)', async () => {
    render(false);
    await flush();
    expect(listWatchlists).not.toHaveBeenCalled();
    expect(api.status).toBe(LISTS_STATUS.LOADING);
    expect(api.committed).toEqual([]);
  });

  it('reads once at mount when enabled, and not again on a re-render', async () => {
    listWatchlists.mockResolvedValue([committed('a')]);
    render(true);
    await flush();
    render(true);
    await flush();
    expect(listWatchlists).toHaveBeenCalledTimes(1);
    expect(api.status).toBe(LISTS_STATUS.READY);
  });

  it('starts reading when it becomes enabled (the agent resolved after the hub mounted), once', async () => {
    listWatchlists.mockResolvedValue([committed('a')]);
    render(false);
    await flush();
    expect(listWatchlists).not.toHaveBeenCalled();
    render(true);
    await flush();
    expect(listWatchlists).toHaveBeenCalledTimes(1);
    expect(api.committed.map((l) => l.watchlistId)).toEqual(['a']);
  });

  it('NEVER on a timer, a focus or a visibility change: an hour passes, the window is focused, the tab is shown — still one read', async () => {
    vi.useFakeTimers();
    listWatchlists.mockResolvedValue([committed('a')]);
    render(true);
    await flush();
    act(() => { vi.advanceTimersByTime(60 * 60 * 1000); });
    act(() => {
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('online'));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await flush();
    expect(listWatchlists).toHaveBeenCalledTimes(1);
  });

  it('reads again only when asked: refresh() (an equip, a sheet closing) is one more read', async () => {
    listWatchlists.mockResolvedValue([committed('a')]);
    render(true);
    await flush();
    act(() => { api.refresh(); });
    await flush();
    expect(listWatchlists).toHaveBeenCalledTimes(2);
  });
});

describe('useHubLoadout — what it holds', () => {
  it('only the committed lists, as whole documents (the idea pointer rides on each)', async () => {
    listWatchlists.mockResolvedValue([
      committed('a', { currentHypothesisVersion: 3 }), draft('b'), committed('c'), { watchlistId: 'd' },
    ]);
    render(true);
    await flush();
    expect(api.committed.map((l) => l.watchlistId)).toEqual(['a', 'c']);
    expect(api.committed[0].currentHypothesisVersion).toBe(3);
  });

  it('a non-array answer is an empty list, not a crash', async () => {
    listWatchlists.mockResolvedValue(null);
    render(true);
    await flush();
    expect(api.status).toBe(LISTS_STATUS.READY);
    expect(api.committed).toEqual([]);
  });

  it('a failed first read is an error (not an empty list), logged once; retry() reads again and recovers', async () => {
    listWatchlists.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce([committed('a')]);
    render(true);
    await flush();
    expect(api.status).toBe(LISTS_STATUS.ERROR);
    expect(api.committed).toEqual([]);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    act(() => { api.retry(); });
    expect(api.status).toBe(LISTS_STATUS.LOADING);
    await flush();
    expect(api.status).toBe(LISTS_STATUS.READY);
    expect(api.committed.map((l) => l.watchlistId)).toEqual(['a']);
    expect(listWatchlists).toHaveBeenCalledTimes(2);
  });

  it('a failed REFRESH keeps the lists already held — the card never goes blank over a transient failure', async () => {
    listWatchlists.mockResolvedValueOnce([committed('a')]).mockRejectedValueOnce(new Error('later'));
    render(true);
    await flush();
    act(() => { api.refresh(); });
    await flush();
    expect(api.status).toBe(LISTS_STATUS.READY);
    expect(api.committed.map((l) => l.watchlistId)).toEqual(['a']);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});

describe('useHubLoadout — late answers', () => {
  it('only the newest request may publish: an older answer arriving last is dropped', async () => {
    const first = deferred();
    const second = deferred();
    listWatchlists.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    render(true);
    await flush();
    act(() => { api.refresh(); });
    await act(async () => { second.resolve([committed('new')]); await Promise.resolve(); });
    await act(async () => { first.resolve([committed('old')]); await Promise.resolve(); });
    expect(api.committed.map((l) => l.watchlistId)).toEqual(['new']);
  });

  it('an answer after unmount publishes nothing and logs nothing', async () => {
    const pending = deferred();
    listWatchlists.mockReturnValueOnce(pending.promise);
    render(true);
    await flush();
    act(() => { root.unmount(); });
    root = null;
    await act(async () => { pending.resolve([committed('a')]); await Promise.resolve(); });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('an answer after the reader was disabled is dropped', async () => {
    const pending = deferred();
    listWatchlists.mockReturnValueOnce(pending.promise);
    render(true);
    await flush();
    render(false);
    await act(async () => { pending.resolve([committed('a')]); await Promise.resolve(); });
    expect(api.status).toBe(LISTS_STATUS.LOADING);
    expect(api.committed).toEqual([]);
  });

  it('a failure after unmount is neither published nor re-logged beyond the one report', async () => {
    const pending = deferred();
    listWatchlists.mockReturnValueOnce(pending.promise);
    render(true);
    await flush();
    act(() => { root.unmount(); });
    root = null;
    await act(async () => { pending.reject(new Error('late')); await Promise.resolve(); });
    expect(errorSpy.mock.calls.length).toBeLessThanOrEqual(1);
  });
});
