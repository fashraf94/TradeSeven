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

function Harness({ enabled, ownerKey, equippedId }) {
  api = useHubLoadout({ enabled, ownerKey, equippedId });
  return null;
}
const render = (enabled, ownerKey = null, equippedId = null) => {
  if (!host) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  }
  act(() => { root.render(<Harness enabled={enabled} ownerKey={ownerKey} equippedId={equippedId} />); });
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

describe("useHubLoadout — whose lists these are (spec §3: drop another owner's results before the next effect paints)", () => {
  it("on an owner change the previous owner's lists drop in the same render, before the new read resolves", async () => {
    listWatchlists.mockResolvedValueOnce([committed('a-list')]);
    render(true, 'owner-a');
    await flush();
    expect(api.committed.map((l) => l.watchlistId)).toEqual(['a-list']);
    const pending = deferred();
    listWatchlists.mockReturnValueOnce(pending.promise);
    render(true, 'owner-b');
    expect(api.status).toBe(LISTS_STATUS.LOADING);
    expect(api.committed).toEqual([]);
    await act(async () => { pending.resolve([committed('b-list')]); await Promise.resolve(); });
    expect(api.committed.map((l) => l.watchlistId)).toEqual(['b-list']);
  });

  it('a read still in flight for the previous owner is abandoned: it cannot publish under the new one', async () => {
    const old = deferred();
    const fresh = deferred();
    listWatchlists.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    render(true, 'owner-a');
    await flush();
    render(true, 'owner-b');
    await act(async () => { old.resolve([committed('a-list')]); await Promise.resolve(); });
    expect(api.committed).toEqual([]);
    expect(api.status).toBe(LISTS_STATUS.LOADING);
    await act(async () => { fresh.resolve([committed('b-list')]); await Promise.resolve(); });
    expect(api.committed.map((l) => l.watchlistId)).toEqual(['b-list']);
  });

  it("a failed read for the new owner is an error — the previous owner's lists are not kept as a fallback", async () => {
    listWatchlists.mockResolvedValueOnce([committed('a-list')]).mockRejectedValueOnce(new Error('offline'));
    render(true, 'owner-a');
    await flush();
    render(true, 'owner-b');
    await flush();
    expect(api.status).toBe(LISTS_STATUS.ERROR);
    expect(api.committed).toEqual([]);
  });

  it('the same owner keeps its lists across a re-render (the key is not a re-read)', async () => {
    listWatchlists.mockResolvedValue([committed('a-list')]);
    render(true, 'owner-a');
    await flush();
    render(true, 'owner-a');
    await flush();
    expect(listWatchlists).toHaveBeenCalledTimes(1);
    expect(api.committed.map((l) => l.watchlistId)).toEqual(['a-list']);
  });
});

describe('useHubLoadout — an equip made elsewhere (ruling R-S5-1, "after an equip"; review E4-2)', () => {
  it('an equipped list the lists on hand were not read for is read for once, and then it is known', async () => {
    listWatchlists.mockResolvedValueOnce([committed('wl-1')]).mockResolvedValueOnce([committed('wl-1'), committed('wl-2')]);
    render(true, 'owner-a', 'wl-1');
    await flush();
    expect(listWatchlists).toHaveBeenCalledTimes(1);
    // another tab equips a list committed after this hub read: the agent subscription delivers the new id
    render(true, 'owner-a', 'wl-2');
    await flush();
    expect(listWatchlists).toHaveBeenCalledTimes(2);
    expect(api.committed.map((l) => l.watchlistId)).toEqual(['wl-1', 'wl-2']);
    expect(api.readFor).toBe('wl-2');
    render(true, 'owner-a', 'wl-2');
    await flush();
    expect(listWatchlists).toHaveBeenCalledTimes(2);
  });

  it('a list that was already gone when the hub mounted is answered by the mount read: no second read, however often it renders', async () => {
    listWatchlists.mockResolvedValue([committed('wl-1')]);
    render(true, 'owner-a', 'wl-gone');
    await flush();
    for (let i = 0; i < 3; i += 1) { render(true, 'owner-a', 'wl-gone'); await flush(); }
    expect(listWatchlists).toHaveBeenCalledTimes(1);
    expect(api.status).toBe(LISTS_STATUS.READY);
    expect(api.readFor).toBe('wl-gone');
  });

  it('an id equipped elsewhere that is also gone is read for ONCE, never in a loop; another missing id is read for once more', async () => {
    listWatchlists.mockResolvedValue([committed('wl-1')]);
    render(true, 'owner-a', 'wl-1');
    await flush();
    render(true, 'owner-a', 'wl-gone');
    await flush();
    expect(listWatchlists).toHaveBeenCalledTimes(2);
    for (let i = 0; i < 3; i += 1) { render(true, 'owner-a', 'wl-gone'); await flush(); }
    expect(listWatchlists).toHaveBeenCalledTimes(2);
    render(true, 'owner-a', 'wl-other');
    await flush();
    expect(listWatchlists).toHaveBeenCalledTimes(3);
    expect(api.readFor).toBe('wl-other');
  });

  it('an equipped list the lists on hand already know costs no extra read; neither does no equipped list', async () => {
    listWatchlists.mockResolvedValue([committed('wl-1'), committed('wl-2')]);
    render(true, 'owner-a', 'wl-1');
    await flush();
    render(true, 'owner-a', 'wl-2');
    await flush();
    render(true, 'owner-a', null);
    await flush();
    expect(listWatchlists).toHaveBeenCalledTimes(1);
  });

  it("waits for the first read: an id the first read has not answered yet is not a second read, and a FAILED first read is Retry's, not a loop", async () => {
    const pending = deferred();
    listWatchlists.mockReturnValueOnce(pending.promise);
    render(true, 'owner-a', 'wl-1');
    await flush();
    expect(listWatchlists).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve([committed('wl-1')]); await Promise.resolve(); });
    expect(listWatchlists).toHaveBeenCalledTimes(1);

    listWatchlists.mockReset();
    act(() => { root.unmount(); });
    host.remove();
    host = null;
    root = null;
    listWatchlists.mockRejectedValue(new Error('offline'));
    render(true, 'owner-a', 'wl-9');
    await flush();
    expect(api.status).toBe(LISTS_STATUS.ERROR);
    expect(listWatchlists).toHaveBeenCalledTimes(1);
  });

  it('reads nothing while disabled, whatever the equipped id', async () => {
    render(false, 'owner-a', 'wl-1');
    await flush();
    expect(listWatchlists).not.toHaveBeenCalled();
  });

  it('readFor records the id each settled read was issued under: undefined before any read, null when none was equipped', async () => {
    listWatchlists.mockResolvedValue([committed('wl-1')]);
    render(false, 'owner-a', 'wl-1');
    await flush();
    expect(api.readFor).toBeUndefined();
    render(true, 'owner-a', null);
    await flush();
    expect(api.readFor).toBeNull();
    act(() => { api.refresh(); });
    await flush();
    expect(api.readFor).toBeNull();
  });

  it('a new account is read under the id it has: its own mount read answers it, with no extra read', async () => {
    listWatchlists.mockResolvedValue([committed('wl-1')]);
    render(true, 'owner-a', 'wl-gone');
    await flush();
    render(true, 'owner-b', 'wl-gone');
    await flush();
    expect(listWatchlists).toHaveBeenCalledTimes(2);
    expect(api.readFor).toBe('wl-gone');
  });

  it('a failed read for a newly equipped, unknown list is an error — the held lists cannot speak for it; a failed refresh for a known one keeps them', async () => {
    listWatchlists.mockResolvedValueOnce([committed('wl-1')]).mockRejectedValueOnce(new Error('offline')).mockRejectedValueOnce(new Error('offline'));
    render(true, 'owner-a', 'wl-1');
    await flush();
    render(true, 'owner-a', 'wl-new');
    await flush();
    expect(api.status).toBe(LISTS_STATUS.ERROR);
    expect(api.readFor).toBe('wl-new');
    expect(api.committed.map((l) => l.watchlistId)).toEqual(['wl-1']);
    expect(listWatchlists).toHaveBeenCalledTimes(2);
    // back to a list the held lists know: a plain refresh that fails keeps what is held
    listWatchlists.mockReset();
    listWatchlists.mockResolvedValueOnce([committed('wl-1')]).mockRejectedValueOnce(new Error('later'));
    act(() => { api.retry(); });
    await flush();
    expect(api.status).toBe(LISTS_STATUS.READY);
  });

  it('two foreign equips in a row: only the newest read publishes', async () => {
    const first = deferred();
    const second = deferred();
    listWatchlists.mockResolvedValueOnce([committed('wl-1')]).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    render(true, 'owner-a', 'wl-1');
    await flush();
    render(true, 'owner-a', 'wl-2');
    await flush();
    render(true, 'owner-a', 'wl-3');
    await flush();
    expect(listWatchlists).toHaveBeenCalledTimes(3);
    await act(async () => { second.resolve([committed('wl-1'), committed('wl-3')]); await Promise.resolve(); });
    await act(async () => { first.resolve([committed('wl-1'), committed('wl-2')]); await Promise.resolve(); });
    expect(api.committed.map((l) => l.watchlistId)).toEqual(['wl-1', 'wl-3']);
    expect(api.readFor).toBe('wl-3');
  });
});

describe('useHubLoadout — disabled means disabled (builder mutant R06)', () => {
  it('a newly equipped, unknown list costs no read once the reader is disabled', async () => {
    listWatchlists.mockResolvedValue([committed('wl-1')]);
    render(true, 'owner-a', 'wl-1');
    await flush();
    render(false, 'owner-a', 'wl-2');
    await flush();
    expect(listWatchlists).toHaveBeenCalledTimes(1);
  });
});
