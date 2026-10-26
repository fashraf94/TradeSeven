// @vitest-environment jsdom
//
// Command Center hub, slice S6 (ruling R-S6-2; spec V1.2 §8.1) — the idea reader: a captured uid + authEpoch + equipped-list key,
// one request in flight per key, stale answers ignored, cleared on an owner or list change, reads on mount / a list change /
// a confirmed return / an explicit Retry, a dirty mark for ONE follow-up, a 30 s manual wait, and no timer.

import React, { StrictMode, act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { listHypothesisVersions } = vi.hoisted(() => ({ listHypothesisVersions: vi.fn() }));
vi.mock('../../../services/hypothesisVersionService', () => ({ listHypothesisVersions }));

import useHubResearch, { RETRY_COOLDOWN_MS, STALLED_AFTER_MS, forgetResearchAdmission } from './useHubResearch';
import { RESEARCH_READ } from './researchView';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const AUTH = (uid = 'u-1', authEpoch = 1) => ({ signedIn: true, uid, authEpoch });
const BODY = (listId, over = {}) => ({ watchlistId: listId, currentVersion: 1, versions: [{ version: 1, statement: `Idea on ${listId}`, status: 'draft' }], research: [], ...over });

/** A promise a row settles by hand. */
function deferred() {
  let resolve; let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

let root;
let host;
let latest;
// Every render's result, in order: what a render held is judged here, not only what the tree settled to.
let renders;
let props;
let errorSpy;

function Probe(p) {
  latest = useHubResearch(p);
  renders.push({ key: latest.key, status: latest.status, data: latest.data });
  return null;
}
const render = (over = {}, { strict = false } = {}) => {
  props = { auth: AUTH(), listId: 'wl-1', gateOn: true, ...over };
  const el = <Probe {...props} />;
  act(() => { root.render(strict ? <StrictMode>{el}</StrictMode> : el); });
};
const rerender = (over) => {
  props = { ...props, ...over };
  act(() => { root.render(<Probe {...props} />); });
};
const settle = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }); };

beforeEach(() => {
  listHypothesisVersions.mockReset();
  // What the account is remembered to be outlives a mount (Q-S6-4): every row starts from nothing.
  forgetResearchAdmission();
  renders = [];
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  errorSpy.mockRestore();
  vi.useRealTimers();
});

describe('what is read, and when', () => {
  it('the client gate off: nothing is asked, whatever else is known', async () => {
    render({ gateOn: false });
    await settle();
    expect(latest.status).toBe(RESEARCH_READ.GATE_OFF);
    expect(latest.key).toBeNull();
    expect(latest.listId, 'the list is named only for a key that reads').toBeNull();
    latest.invalidate();
    latest.retry();
    await settle();
    expect(listHypothesisVersions).not.toHaveBeenCalled();
    // Anything but exactly true is off.
    for (const gateOn of [undefined, null, 1, 'true']) {
      rerender({ gateOn });
      await settle();
      expect(latest.status, String(gateOn)).toBe(RESEARCH_READ.GATE_OFF);
    }
    expect(listHypothesisVersions).not.toHaveBeenCalled();
  });

  it('nothing to ask about: signed out, unresolved, or no equipped list → idle, no request', async () => {
    for (const over of [{ auth: null }, { auth: { signedIn: false } }, { auth: { signedIn: false, uid: 'u-1', authEpoch: 1 } }, { listId: null }, { listId: '' }, { auth: AUTH('') }]) {
      render(over);
      await settle();
      expect(latest.status, JSON.stringify(over)).toBe(RESEARCH_READ.IDLE);
    }
    expect(listHypothesisVersions).not.toHaveBeenCalled();
  });

  it('on mount with a known list: ONE request for that list, then the answer is held with its time', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(7_000);
    listHypothesisVersions.mockResolvedValueOnce(BODY('wl-1'));
    render();
    expect(latest.status).toBe(RESEARCH_READ.LOADING);
    expect(latest.data).toBeNull();
    await settle();
    expect(listHypothesisVersions).toHaveBeenCalledTimes(1);
    expect(listHypothesisVersions).toHaveBeenCalledWith('wl-1');
    expect(latest).toMatchObject({ status: RESEARCH_READ.READY, key: 'u-1:1:wl-1', listId: 'wl-1', asOf: 7_000, refreshing: false });
    expect(latest.data).toMatchObject({ currentVersion: 1, versionCount: 1 });
    now.mockRestore();
  });

  it('React\'s double effect reads once (the key\'s own first read does not mark itself dirty)', async () => {
    listHypothesisVersions.mockResolvedValue(BODY('wl-1'));
    render({}, { strict: true });
    await settle();
    expect(listHypothesisVersions).toHaveBeenCalledTimes(1);
    expect(latest.status).toBe(RESEARCH_READ.READY);
  });

  it('a re-render with the same key reads nothing more, and there is no timer: ten minutes later still one request', async () => {
    vi.useFakeTimers();
    listHypothesisVersions.mockResolvedValue(BODY('wl-1'));
    render();
    await settle();
    rerender({});
    rerender({ gateOn: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(10 * 60 * 1000); });
    expect(listHypothesisVersions).toHaveBeenCalledTimes(1);
  });

  it('a list change reads the new list, and the former list\'s idea never shows for the new key (cleared in render)', async () => {
    listHypothesisVersions.mockImplementation((id) => Promise.resolve(BODY(id)));
    render();
    await settle();
    expect(latest.data.versions[0].statement).toBe('Idea on wl-1');
    const held = deferred();
    listHypothesisVersions.mockReturnValueOnce(held.promise);
    rerender({ listId: 'wl-2' });
    // The very render that brings the new key holds nothing of the old one.
    expect(latest).toMatchObject({ key: 'u-1:1:wl-2', status: RESEARCH_READ.LOADING, data: null });
    await settle();
    expect(listHypothesisVersions).toHaveBeenLastCalledWith('wl-2');
    held.resolve(BODY('wl-2'));
    await settle();
    expect(latest.data.versions[0].statement).toBe('Idea on wl-2');
    // In EVERY render, not only the one the tree settled to: no render for wl-2 ever held wl-1's idea.
    const forNew = renders.filter((r) => r.key === 'u-1:1:wl-2');
    expect(forNew.length).toBeGreaterThan(0);
    for (const r of forNew) expect(r.data === null || r.data.versions[0].statement === 'Idea on wl-2').toBe(true);
  });

  it('an owner or an epoch change clears and reads again; a late answer for the former owner is dropped', async () => {
    const first = deferred();
    listHypothesisVersions.mockReturnValueOnce(first.promise);
    render();
    const second = deferred();
    listHypothesisVersions.mockReturnValueOnce(second.promise);
    rerender({ auth: AUTH('u-2', 1) });
    expect(latest).toMatchObject({ key: 'u-2:1:wl-1', status: RESEARCH_READ.LOADING, data: null });
    first.resolve(BODY('wl-1', { currentVersion: 7 }));
    await settle();
    expect(latest.data, 'u-1\'s answer is not u-2\'s').toBeNull();
    second.resolve(BODY('wl-1', { currentVersion: 2, versions: [{ version: 2, statement: 'u-2 idea', status: 'draft' }] }));
    await settle();
    expect(latest.data.currentVersion).toBe(2);
    // The same user in a new auth epoch is a new owner.
    listHypothesisVersions.mockResolvedValueOnce(BODY('wl-1'));
    rerender({ auth: AUTH('u-2', 2) });
    expect(latest).toMatchObject({ key: 'u-2:2:wl-1', data: null });
    await settle();
    expect(listHypothesisVersions).toHaveBeenCalledTimes(3);
  });

  it('losing the list or the account while a request is out: its answer is ignored, and nothing shows', async () => {
    const out = deferred();
    listHypothesisVersions.mockReturnValueOnce(out.promise);
    render();
    rerender({ listId: null });
    out.resolve(BODY('wl-1'));
    await settle();
    expect(latest).toMatchObject({ status: RESEARCH_READ.IDLE, data: null });
    // ...and coming back to the same list reads it afresh, not from the answer that was dropped.
    const again = deferred();
    listHypothesisVersions.mockReturnValueOnce(again.promise);
    rerender({ listId: 'wl-1' });
    expect(latest).toMatchObject({ status: RESEARCH_READ.LOADING, data: null });
    await settle();
    expect(listHypothesisVersions).toHaveBeenCalledTimes(2);
    again.resolve(BODY('wl-1'));
    await settle();
    expect(latest.status).toBe(RESEARCH_READ.READY);
    // A list held, lost and found again is a list change both ways: what was held before the loss does not come back.
    listHypothesisVersions.mockResolvedValue(BODY('wl-1'));
    rerender({ listId: null });
    const third = deferred();
    listHypothesisVersions.mockReturnValueOnce(third.promise);
    rerender({ listId: 'wl-1' });
    expect(latest.data).toBeNull();
    third.resolve(BODY('wl-1'));
    await settle();
  });

  it('a late answer for a key that was left changes nothing for the key now asked: not its data, and not its one-request-in-flight', async () => {
    const old = deferred();
    const now = deferred();
    listHypothesisVersions.mockReturnValueOnce(old.promise).mockReturnValueOnce(now.promise).mockResolvedValue(BODY('wl-2'));
    render();
    rerender({ listId: 'wl-2' });
    // The old key fails late: wl-2\'s request must still count as in flight, so a return marks it dirty instead of starting a second.
    old.reject(new Error('late'));
    await settle();
    act(() => latest.invalidate());
    expect(listHypothesisVersions).toHaveBeenCalledTimes(2);
    now.resolve(BODY('wl-2'));
    await settle();
    expect(listHypothesisVersions).toHaveBeenCalledTimes(3);
    // ...and the same for a late success.
    const old2 = deferred();
    const now2 = deferred();
    listHypothesisVersions.mockReset();
    listHypothesisVersions.mockReturnValueOnce(old2.promise).mockReturnValueOnce(now2.promise).mockResolvedValue(BODY('wl-3'));
    rerender({ listId: 'wl-9' });
    rerender({ listId: 'wl-3' });
    old2.resolve(BODY('wl-9'));
    await settle();
    act(() => latest.invalidate());
    expect(listHypothesisVersions).toHaveBeenCalledTimes(2);
  });

  it('an answer that lands after the hub is gone does nothing', async () => {
    const out = deferred();
    listHypothesisVersions.mockReturnValueOnce(out.promise);
    render();
    act(() => root.unmount());
    root = createRoot(host);
    out.resolve(BODY('wl-1'));
    await settle();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('...and it starts no follow-up read, even when a return marked the request dirty before the hub went', async () => {
    const out = deferred();
    listHypothesisVersions.mockReturnValueOnce(out.promise);
    render();
    act(() => latest.invalidate());
    act(() => root.unmount());
    root = createRoot(host);
    out.resolve(BODY('wl-1'));
    await settle();
    expect(listHypothesisVersions).toHaveBeenCalledTimes(1);
    // The same for a failure.
    const failing = deferred();
    listHypothesisVersions.mockReset();
    listHypothesisVersions.mockReturnValueOnce(failing.promise);
    render();
    act(() => latest.invalidate());
    act(() => root.unmount());
    root = createRoot(host);
    failing.reject(new Error('gone'));
    await settle();
    expect(listHypothesisVersions).toHaveBeenCalledTimes(1);
  });

  it('the wait before a second manual Retry is the spec\'s 30 seconds', () => {
    expect(RETRY_COOLDOWN_MS).toBe(30_000);
  });
});

describe('a confirmed return (invalidate): once, even when the equipped id is unchanged', () => {
  it('an unchanged list is read once more', async () => {
    listHypothesisVersions.mockResolvedValue(BODY('wl-1'));
    render();
    await settle();
    act(() => latest.invalidate());
    await settle();
    expect(listHypothesisVersions).toHaveBeenCalledTimes(2);
    expect(latest.status).toBe(RESEARCH_READ.READY);
  });

  it('the held idea stays on screen while it is read again (a refresh is not a loading state)', async () => {
    listHypothesisVersions.mockResolvedValueOnce(BODY('wl-1'));
    render();
    await settle();
    const again = deferred();
    listHypothesisVersions.mockReturnValueOnce(again.promise);
    act(() => latest.invalidate());
    expect(latest).toMatchObject({ status: RESEARCH_READ.READY, refreshing: true });
    expect(latest.data).not.toBeNull();
    again.resolve(BODY('wl-1', { currentVersion: 2, versions: [{ version: 2, statement: 'Changed in the Forge', status: 'ready' }] }));
    await settle();
    expect(latest).toMatchObject({ refreshing: false });
    expect(latest.data.currentVersion).toBe(2);
  });

  it('triggers during a request mark it dirty — ONE fresh read follows, however many came', async () => {
    const first = deferred();
    listHypothesisVersions.mockReturnValueOnce(first.promise);
    render();
    act(() => { latest.invalidate(); latest.invalidate(); latest.invalidate(); });
    expect(listHypothesisVersions).toHaveBeenCalledTimes(1);
    listHypothesisVersions.mockResolvedValue(BODY('wl-1', { currentVersion: 3, versions: [{ version: 3, statement: 'Fresh', status: 'draft' }] }));
    first.resolve(BODY('wl-1'));
    await settle();
    expect(listHypothesisVersions).toHaveBeenCalledTimes(2);
    expect(latest.data.currentVersion).toBe(3);
    await settle();
    expect(listHypothesisVersions).toHaveBeenCalledTimes(2);
  });

  it('a trigger with the follow-up already running marks THAT dirty: still one read at a time per key', async () => {
    const first = deferred();
    const second = deferred();
    listHypothesisVersions.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise).mockResolvedValue(BODY('wl-1'));
    render();
    act(() => latest.invalidate());
    first.resolve(BODY('wl-1'));
    await settle();
    expect(listHypothesisVersions).toHaveBeenCalledTimes(2);
    act(() => latest.invalidate());
    expect(listHypothesisVersions).toHaveBeenCalledTimes(2);
    second.resolve(BODY('wl-1'));
    await settle();
    expect(listHypothesisVersions).toHaveBeenCalledTimes(3);
  });

  it('an equip racing a return: the equip\'s read is for the new list, the return marks IT dirty, the old list\'s answer is ignored, and the reads are three', async () => {
    const old = deferred();
    const equip = deferred();
    listHypothesisVersions.mockReturnValueOnce(old.promise).mockReturnValueOnce(equip.promise).mockResolvedValue(BODY('wl-2', { currentVersion: 9, versions: [{ version: 9, statement: 'Settled', status: 'ready' }] }));
    render();
    rerender({ listId: 'wl-2' });
    act(() => latest.invalidate());
    old.resolve(BODY('wl-1', { currentVersion: 5 }));
    await settle();
    expect(latest.data, 'wl-1\'s answer is not wl-2\'s').toBeNull();
    expect(listHypothesisVersions).toHaveBeenCalledTimes(2);
    equip.resolve(BODY('wl-2'));
    await settle();
    expect(listHypothesisVersions.mock.calls.map(([id]) => id)).toEqual(['wl-1', 'wl-2', 'wl-2']);
    expect(latest.data.currentVersion).toBe(9);
  });

  it('with nothing to ask about a return reads nothing', async () => {
    render({ listId: null });
    act(() => latest.invalidate());
    await settle();
    expect(listHypothesisVersions).not.toHaveBeenCalled();
  });
});

describe('what the answer is', () => {
  it('the typed `disabled` answer is its own state: not an error, no data, and no follow-up read', async () => {
    const out = deferred();
    listHypothesisVersions.mockReturnValueOnce(out.promise);
    render();
    act(() => latest.invalidate());
    out.reject(Object.assign(new Error('off'), { status: 404, code: 'disabled' }));
    await settle();
    expect(latest).toMatchObject({ status: RESEARCH_READ.DISABLED, data: null });
    expect(listHypothesisVersions).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('any other failure is an error: nothing held, nothing inferred', async () => {
    listHypothesisVersions.mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 500, code: 'request_failed' }));
    render();
    await settle();
    expect(latest).toMatchObject({ status: RESEARCH_READ.ERROR, data: null });
    expect(errorSpy).toHaveBeenCalled();
    // A list the server cannot find is an error too, not "no idea".
    listHypothesisVersions.mockRejectedValueOnce(Object.assign(new Error('nf'), { status: 404, code: 'not_found' }));
    rerender({ listId: 'wl-2' });
    await settle();
    expect(latest).toMatchObject({ status: RESEARCH_READ.ERROR, data: null });
  });

  it('a failed refresh keeps the answer held for THIS key, as an error with its age; another key keeps nothing', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(4_000);
    listHypothesisVersions.mockResolvedValueOnce(BODY('wl-1'));
    render();
    await settle();
    listHypothesisVersions.mockRejectedValueOnce(new Error('later'));
    act(() => latest.invalidate());
    await settle();
    expect(latest).toMatchObject({ status: RESEARCH_READ.ERROR, asOf: 4_000, refreshing: false });
    expect(latest.data).not.toBeNull();
    listHypothesisVersions.mockRejectedValueOnce(new Error('other'));
    rerender({ listId: 'wl-2' });
    await settle();
    expect(latest).toMatchObject({ status: RESEARCH_READ.ERROR, data: null, asOf: null });
    now.mockRestore();
  });

  it.each([
    ['a body for another list', BODY('wl-OTHER')],
    ['no versions array', { watchlistId: 'wl-1', currentVersion: 1 }],
    ['a pointer that is not a whole number', BODY('wl-1', { currentVersion: 1.5 })],
    ['a negative pointer', BODY('wl-1', { currentVersion: -1 })],
    ['nothing', null],
  ])('%s is not the list\'s answer: an error', async (_, body) => {
    listHypothesisVersions.mockResolvedValueOnce(body);
    render();
    await settle();
    expect(latest).toMatchObject({ status: RESEARCH_READ.ERROR, data: null });
  });

  it('what is kept: the pointer, the versions (malformed documents set aside, the count taken before), the research and the frozen lists', async () => {
    listHypothesisVersions.mockResolvedValueOnce(BODY('wl-1', {
      currentVersion: 2,
      versions: [{ version: 2, status: 'ready' }, null, { statement: 'no number' }, { version: 0 }, { version: 1, status: 'draft' }],
      research: [{ researchWorkId: 'r' }],
      deployedLists: { 1: { battleId: 'b', name: 'L', tickers: ['X'] } },
    }));
    render();
    await settle();
    expect(latest.data.versions.map((v) => v.version)).toEqual([2, 1]);
    expect(latest.data.versionCount).toBe(5);
    expect(latest.data.research).toEqual([{ researchWorkId: 'r' }]);
    expect(latest.data.deployedLists[1].name).toBe('L');
    listHypothesisVersions.mockResolvedValueOnce(BODY('wl-1'));
    act(() => latest.invalidate());
    await settle();
    expect(latest.data.research).toEqual([]);
    expect(latest.data.deployedLists).toEqual({});
  });
});

describe('an explicit Retry: one per 30 s per key, judged at the press', () => {
  it('a Retry reads; a second inside the wait does not, and says when the next opens', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    listHypothesisVersions.mockRejectedValueOnce(new Error('down'));
    render();
    await settle();
    expect(latest.status).toBe(RESEARCH_READ.ERROR);
    listHypothesisVersions.mockRejectedValueOnce(new Error('still down'));
    act(() => latest.retry());
    await settle();
    expect(listHypothesisVersions).toHaveBeenCalledTimes(2);
    clock.mockReturnValue(1_000_000 + RETRY_COOLDOWN_MS - 1);
    act(() => latest.retry());
    await settle();
    expect(listHypothesisVersions).toHaveBeenCalledTimes(2);
    expect(latest.retryNotBefore).toBe(1_000_000 + RETRY_COOLDOWN_MS);
    // At the wait\'s end it reads.
    clock.mockReturnValue(1_000_000 + RETRY_COOLDOWN_MS);
    listHypothesisVersions.mockResolvedValueOnce(BODY('wl-1'));
    act(() => latest.retry());
    await settle();
    expect(listHypothesisVersions).toHaveBeenCalledTimes(3);
    expect(latest).toMatchObject({ status: RESEARCH_READ.READY, retryNotBefore: null });
    clock.mockRestore();
  });

  it('the wait is per key: a Retry on another list is its own', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(5_000);
    listHypothesisVersions.mockRejectedValue(new Error('down'));
    render();
    await settle();
    act(() => latest.retry());
    await settle();
    expect(listHypothesisVersions).toHaveBeenCalledTimes(2);
    rerender({ listId: 'wl-2' });
    await settle();
    expect(listHypothesisVersions).toHaveBeenCalledTimes(3);
    act(() => latest.retry());
    await settle();
    expect(listHypothesisVersions).toHaveBeenCalledTimes(4);
    clock.mockRestore();
  });

  it('an accepted Retry takes the note of a refused one with it: a wait that has ended is not left on the panel', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    listHypothesisVersions.mockRejectedValue(new Error('down'));
    render();
    await settle();
    act(() => latest.retry());
    await settle();
    clock.mockReturnValue(1_005_000);
    act(() => latest.retry());
    expect(latest.retryNotBefore).toBe(1_030_000);
    clock.mockReturnValue(1_100_000);
    act(() => latest.retry());
    await settle();
    expect(listHypothesisVersions).toHaveBeenCalledTimes(3);
    expect(latest).toMatchObject({ status: RESEARCH_READ.ERROR, retryNotBefore: null });
    clock.mockRestore();
  });

  it('a Retry pressed while the read is out waits behind it and is one follow-up', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const first = deferred();
    listHypothesisVersions.mockReturnValueOnce(first.promise).mockResolvedValue(BODY('wl-1'));
    render();
    act(() => latest.retry());
    expect(listHypothesisVersions).toHaveBeenCalledTimes(1);
    first.resolve(BODY('wl-1'));
    await settle();
    expect(listHypothesisVersions).toHaveBeenCalledTimes(2);
    clock.mockRestore();
  });

  it('a read that never settles does not wedge the panel: a trigger after the Retry wait supersedes it, and its late answer is ignored', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const stuck = deferred();
    listHypothesisVersions.mockReturnValueOnce(stuck.promise).mockResolvedValue(BODY('wl-1', { currentVersion: 4, versions: [{ version: 4, statement: 'Fresh', status: 'draft' }] }));
    render();
    await settle();
    expect(latest.status).toBe(RESEARCH_READ.LOADING);
    // Inside the wait it is still the request in flight: a trigger only marks it dirty.
    clock.mockReturnValue(1_000_000 + STALLED_AFTER_MS - 1);
    act(() => latest.invalidate());
    expect(listHypothesisVersions).toHaveBeenCalledTimes(1);
    // After it, the trigger supersedes it.
    clock.mockReturnValue(1_000_000 + STALLED_AFTER_MS);
    act(() => latest.invalidate());
    await settle();
    expect(listHypothesisVersions).toHaveBeenCalledTimes(2);
    expect(latest).toMatchObject({ status: RESEARCH_READ.READY });
    expect(latest.data.currentVersion).toBe(4);
    stuck.resolve(BODY('wl-1', { currentVersion: 9 }));
    await settle();
    expect(latest.data.currentVersion, 'the superseded read\'s answer is ignored').toBe(4);
    expect(listHypothesisVersions).toHaveBeenCalledTimes(2);
    clock.mockRestore();
  });

  it('the stalled-after wait is the Retry\'s own 30 s', () => {
    expect(STALLED_AFTER_MS).toBe(RETRY_COOLDOWN_MS);
  });

  it('a service call that throws before it returns a promise is a failed read, not a request that never settles', async () => {
    listHypothesisVersions.mockImplementationOnce(() => { throw new Error('URI malformed'); }).mockResolvedValue(BODY('wl-1'));
    render();
    await settle();
    expect(latest).toMatchObject({ status: RESEARCH_READ.ERROR, data: null });
    expect(errorSpy).toHaveBeenCalled();
    act(() => latest.invalidate());
    await settle();
    expect(listHypothesisVersions).toHaveBeenCalledTimes(2);
    expect(latest.status).toBe(RESEARCH_READ.READY);
  });

  it('an account the server does not admit stays "disabled" while it is asked again (no flash of loading)', async () => {
    listHypothesisVersions.mockRejectedValueOnce(Object.assign(new Error('off'), { code: 'disabled' }));
    render();
    await settle();
    expect(latest.status).toBe(RESEARCH_READ.DISABLED);
    const again = deferred();
    listHypothesisVersions.mockReturnValueOnce(again.promise);
    act(() => latest.invalidate());
    expect(latest.status).toBe(RESEARCH_READ.DISABLED);
    expect(renders.some((r) => r.status === RESEARCH_READ.LOADING && r.key === latest.key && renders.indexOf(r) > 1)).toBe(false);
    again.resolve(BODY('wl-1'));
    await settle();
    expect(latest.status).toBe(RESEARCH_READ.READY);
  });

  it('a return that arrived during a read which then FAILS still gets its one follow-up read', async () => {
    const first = deferred();
    listHypothesisVersions.mockReturnValueOnce(first.promise).mockResolvedValue(BODY('wl-1', { currentVersion: 3, versions: [{ version: 3, statement: 'After the return', status: 'draft' }] }));
    render();
    act(() => latest.invalidate());
    first.reject(new Error('down'));
    await settle();
    expect(listHypothesisVersions).toHaveBeenCalledTimes(2);
    expect(latest).toMatchObject({ status: RESEARCH_READ.READY });
    expect(latest.data.currentVersion).toBe(3);
  });

  it('the Retry wait belongs to the owner and epoch as well as the list: the same list under a new epoch is its own key', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(2_000_000);
    listHypothesisVersions.mockRejectedValue(new Error('down'));
    render();
    await settle();
    act(() => latest.retry());
    await settle();
    expect(listHypothesisVersions).toHaveBeenCalledTimes(2);
    rerender({ auth: AUTH('u-1', 2) });
    await settle();
    expect(listHypothesisVersions).toHaveBeenCalledTimes(3);
    act(() => latest.retry());
    await settle();
    expect(listHypothesisVersions, 'a Retry under the new epoch is the first for that key').toHaveBeenCalledTimes(4);
    clock.mockRestore();
  });

  it('a good answer ends the refused press\'s note (it is cleared by success, not left for the panel to hide)', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(3_000_000);
    listHypothesisVersions.mockRejectedValueOnce(new Error('down')).mockRejectedValueOnce(new Error('down'));
    render();
    await settle();
    act(() => latest.retry());
    await settle();
    clock.mockReturnValue(3_005_000);
    act(() => latest.retry());
    expect(latest.retryNotBefore).toBe(3_030_000);
    listHypothesisVersions.mockResolvedValue(BODY('wl-1'));
    act(() => latest.invalidate());
    await settle();
    expect(latest).toMatchObject({ status: RESEARCH_READ.READY, retryNotBefore: null });
    clock.mockRestore();
  });

  it('a Retry with nothing to ask about reads nothing', async () => {
    render({ listId: null });
    act(() => latest.retry());
    await settle();
    expect(listHypothesisVersions).not.toHaveBeenCalled();
  });
});

describe('admission belongs to the account (founder rulings Q-S6-4 and Q-S6-8)', () => {
  const DISABLED = () => Object.assign(new Error('off'), { status: 404, code: 'disabled' });
  const FAILED = () => Object.assign(new Error('boom'), { status: 500, code: 'request_failed' });
  const remount = () => {
    act(() => root.unmount());
    root = createRoot(host);
  };

  it('nothing is remembered before an answer: loading, and an error with no earlier answer, carry none', async () => {
    listHypothesisVersions.mockRejectedValueOnce(FAILED());
    render();
    expect(latest.lastAnswer).toBeNull();
    await settle();
    expect(latest).toMatchObject({ status: RESEARCH_READ.ERROR, lastAnswer: null });
    // no reader at all: nothing to remember either
    rerender({ gateOn: false });
    expect(latest.lastAnswer).toBeNull();
  });

  it('a successful read is remembered for the account, whatever list it was for', async () => {
    listHypothesisVersions.mockResolvedValueOnce(BODY('wl-1'));
    render();
    await settle();
    expect(latest).toMatchObject({ status: RESEARCH_READ.READY, lastAnswer: RESEARCH_READ.READY });
  });

  it('it survives a list change: the next list is loading (its own view cleared) while the account stays remembered, in the very render of the change', async () => {
    listHypothesisVersions.mockResolvedValueOnce(BODY('wl-1'));
    render();
    await settle();
    const second = deferred();
    listHypothesisVersions.mockReturnValueOnce(second.promise);
    renders = [];
    rerender({ listId: 'wl-2' });
    expect(renders[0]).toMatchObject({ key: 'u-1:1:wl-2', status: RESEARCH_READ.LOADING, data: null });
    expect(renders[0]).toBeDefined();
    expect(latest).toMatchObject({ status: RESEARCH_READ.LOADING, data: null, lastAnswer: RESEARCH_READ.READY });
    // ...and losing the list altogether (idle) keeps it too: it is the account's, not the list's
    rerender({ listId: null });
    expect(latest).toMatchObject({ status: RESEARCH_READ.IDLE, lastAnswer: RESEARCH_READ.READY });
  });

  it('it survives a failed refresh, with the old answer held or not', async () => {
    listHypothesisVersions.mockResolvedValueOnce(BODY('wl-1'));
    render();
    await settle();
    listHypothesisVersions.mockRejectedValueOnce(FAILED());
    act(() => latest.invalidate());
    await settle();
    expect(latest).toMatchObject({ status: RESEARCH_READ.ERROR, lastAnswer: RESEARCH_READ.READY });
    expect(latest.data, 'the old answer is still held for this list').not.toBeNull();
    // another list whose first read FAILS: nothing held for it, the account still remembered
    listHypothesisVersions.mockRejectedValueOnce(FAILED());
    rerender({ listId: 'wl-2' });
    await settle();
    expect(latest).toMatchObject({ status: RESEARCH_READ.ERROR, data: null, lastAnswer: RESEARCH_READ.READY });
  });

  it('it survives a hub remount (module memory, not the hook\'s state): the first render of the new mount already has it', async () => {
    listHypothesisVersions.mockResolvedValueOnce(BODY('wl-1'));
    render();
    await settle();
    remount();
    const out = deferred();
    listHypothesisVersions.mockReturnValueOnce(out.promise);
    renders = [];
    let first = null;
    function Spy(p) {
      const r = useHubResearch(p);
      if (first === null) first = { status: r.status, data: r.data, lastAnswer: r.lastAnswer };
      return null;
    }
    act(() => { root.render(<Spy {...props} />); });
    expect(first).toEqual({ status: RESEARCH_READ.LOADING, data: null, lastAnswer: RESEARCH_READ.READY });
  });

  it('a remembered answer is never written to storage', async () => {
    const set = vi.spyOn(Storage.prototype, 'setItem');
    listHypothesisVersions.mockResolvedValueOnce(BODY('wl-1'));
    render();
    await settle();
    listHypothesisVersions.mockRejectedValueOnce(DISABLED());
    rerender({ listId: 'wl-2' });
    await settle();
    expect(set).not.toHaveBeenCalled();
    expect(document.cookie).toBe('');
    set.mockRestore();
  });

  it('a typed disabled replaces it, and the next success replaces that: the latest settled answer for the account', async () => {
    listHypothesisVersions.mockResolvedValueOnce(BODY('wl-1'));
    render();
    await settle();
    expect(latest.lastAnswer).toBe(RESEARCH_READ.READY);
    listHypothesisVersions.mockRejectedValueOnce(DISABLED());
    rerender({ listId: 'wl-2' });
    await settle();
    expect(latest).toMatchObject({ status: RESEARCH_READ.DISABLED, lastAnswer: RESEARCH_READ.DISABLED });
    // a list change keeps the refusal while the next list loads
    const third = deferred();
    listHypothesisVersions.mockReturnValueOnce(third.promise);
    rerender({ listId: 'wl-3' });
    expect(latest).toMatchObject({ status: RESEARCH_READ.LOADING, lastAnswer: RESEARCH_READ.DISABLED });
    third.resolve(BODY('wl-3'));
    await settle();
    expect(latest).toMatchObject({ status: RESEARCH_READ.READY, lastAnswer: RESEARCH_READ.READY });
  });

  it('another account or another epoch starts with nothing: in the very render that brings it, and for good', async () => {
    listHypothesisVersions.mockResolvedValue(BODY('wl-1'));
    render();
    await settle();
    expect(latest.lastAnswer).toBe(RESEARCH_READ.READY);
    const out = deferred();
    listHypothesisVersions.mockReturnValueOnce(out.promise);
    renders = [];
    let seen = [];
    function Spy(p) {
      const r = useHubResearch(p);
      seen.push(r.lastAnswer);
      return null;
    }
    act(() => { root.render(<Spy {...props} auth={AUTH('u-2', 1)} />); });
    expect(seen[0], 'no render of the new owner holds the former one\'s answer').toBeNull();
    // back to the first account: its memory was let go when the owner changed
    seen = [];
    act(() => { root.render(<Spy {...props} auth={AUTH('u-1', 1)} />); });
    expect(seen[0]).toBeNull();
    out.resolve(BODY('wl-1'));
    await settle();
    // a new epoch of the same account is another owner too
    seen = [];
    const next = deferred();
    listHypothesisVersions.mockReturnValueOnce(next.promise);
    act(() => { root.render(<Spy {...props} auth={AUTH('u-1', 2)} />); });
    expect(seen[0]).toBeNull();
  });

  it('signing out forgets it: signed out, and again signed in as the same account, nothing is remembered until a read settles', async () => {
    listHypothesisVersions.mockResolvedValueOnce(BODY('wl-1'));
    render();
    await settle();
    expect(latest.lastAnswer).toBe(RESEARCH_READ.READY);
    rerender({ auth: null });
    expect(latest).toMatchObject({ status: RESEARCH_READ.IDLE, lastAnswer: null });
    const out = deferred();
    listHypothesisVersions.mockReturnValueOnce(out.promise);
    rerender({ auth: AUTH() });
    expect(latest).toMatchObject({ status: RESEARCH_READ.LOADING, lastAnswer: null });
    out.resolve(BODY('wl-1'));
    await settle();
    expect(latest.lastAnswer).toBe(RESEARCH_READ.READY);
  });

  it('an answer that arrives after the hub is gone, or for a list the hub moved on from, writes nothing', async () => {
    const late = deferred();
    listHypothesisVersions.mockReturnValueOnce(late.promise);
    render();
    const second = deferred();
    listHypothesisVersions.mockReturnValueOnce(second.promise);
    rerender({ listId: 'wl-2' });
    late.resolve(BODY('wl-1'));
    await settle();
    expect(latest, 'the superseded list\'s success remembers nothing').toMatchObject({ status: RESEARCH_READ.LOADING, lastAnswer: null });
    act(() => root.unmount());
    second.resolve(BODY('wl-2'));
    await settle();
    root = createRoot(host);
    render();
    expect(latest.lastAnswer, 'nor one that landed after the unmount').toBeNull();
  });

  it('a malformed answer (the wrong list, or no versions) is not a success: nothing is remembered', async () => {
    listHypothesisVersions.mockResolvedValueOnce({ watchlistId: 'other', currentVersion: 1, versions: [] });
    render();
    await settle();
    expect(latest).toMatchObject({ status: RESEARCH_READ.ERROR, lastAnswer: null });
    listHypothesisVersions.mockResolvedValueOnce({ watchlistId: 'wl-2', currentVersion: 1 });
    rerender({ listId: 'wl-2' });
    await settle();
    expect(latest).toMatchObject({ status: RESEARCH_READ.ERROR, lastAnswer: null });
  });

  it('React\'s double render and effect do not lose it, and the owner key tolerates a colon in the list id', async () => {
    listHypothesisVersions.mockResolvedValue(BODY('wl:odd:1'));
    render({ listId: 'wl:odd:1' }, { strict: true });
    await settle();
    expect(latest).toMatchObject({ status: RESEARCH_READ.READY, lastAnswer: RESEARCH_READ.READY });
    remount();
    act(() => { root.render(<StrictMode><Probe {...props} listId="wl:odd:2" /></StrictMode>); });
    expect(latest.lastAnswer).toBe(RESEARCH_READ.READY);
  });
});
