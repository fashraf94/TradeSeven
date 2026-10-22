// src/utils/activeBattlesPoll.test.js
//
// Command Center slice S3 (ruling R-S3-3) — the active poll's metadata and run
// bookkeeping, pure. App's poll calls these; the App rows that drive the real
// poll are in src/App.activeBattlesPoll.owner.jsdom.test.jsx.

import { describe, it, expect, vi } from 'vitest';
import {
  initialActivePoll, pollCaptureMatches, activePollRefreshStarted, activePollSettled, createActivePollFlights,
} from './activeBattlesPoll';

const A1 = Object.freeze({ resolved: true, uid: 'uid-A', authEpoch: 1 });
const A3 = Object.freeze({ resolved: true, uid: 'uid-A', authEpoch: 3 });
const UNRESOLVED = Object.freeze({ resolved: false, uid: null, authEpoch: 0 });
const T = Date.UTC(2026, 9, 22, 14, 0);

describe('initialActivePoll', () => {
  it('loading, no retained owner, no time, no error, no refresh — for the epoch it names', () => {
    expect(initialActivePoll(4)).toEqual({ epoch: 4, status: 'loading', ownerUid: null, ownerEpoch: null, lastSuccessfulAt: null, error: null, refreshing: false });
    expect(initialActivePoll().epoch).toBe(0);
    expect(Object.isFrozen(initialActivePoll(1))).toBe(true);
  });
});

describe('pollCaptureMatches — a run queries only for the identity it captured', () => {
  it('a resolved capture matches its own uid only', () => {
    expect(pollCaptureMatches(A1, 'uid-A')).toBe(true);
    expect(pollCaptureMatches(A1, 'uid-B')).toBe(false);
    expect(pollCaptureMatches({ resolved: true, uid: null, authEpoch: 2 }, 'uid-A')).toBe(false);
  });
  it('an unresolved capture (auth has not answered) queries as today', () => {
    expect(pollCaptureMatches(UNRESOLVED, 'uid-A')).toBe(true);
  });
  it('no uid, no capture: nothing', () => {
    expect(pollCaptureMatches(A1, '')).toBe(false);
    expect(pollCaptureMatches(A1, null)).toBe(false);
    expect(pollCaptureMatches(null, 'uid-A')).toBe(false);
  });
});

describe('activePollSettled', () => {
  const meta = initialActivePoll(1);

  it('a success retains its owner (the queried uid) and epoch, its time, and clears the error', () => {
    const failed = activePollSettled(meta, A1, { ok: false, error: new Error('blip') }, false);
    const next = activePollSettled(failed, A1, { ok: true, uid: 'uid-A', at: T }, false);
    expect(next).toEqual({ epoch: 1, status: 'ready', ownerUid: 'uid-A', ownerEpoch: 1, lastSuccessfulAt: T, error: null, refreshing: false });
  });

  it('a failure keeps the retained owner and time and records the error; the list is never touched here', () => {
    const ok = activePollSettled(meta, A1, { ok: true, uid: 'uid-A', at: T }, false);
    const error = new Error('unavailable');
    const failed = activePollSettled(ok, A1, { ok: false, error }, false);
    expect(failed).toEqual({ ...ok, status: 'error', error });
    expect(failed.ownerUid).toBe('uid-A');
    expect(failed.lastSuccessfulAt).toBe(T);
  });

  it('the same failure again returns the same metadata (no re-render); a different one does not', () => {
    const failed = activePollSettled(meta, A1, { ok: false, error: new Error('unavailable') }, false);
    expect(activePollSettled(failed, A1, { ok: false, error: new Error('unavailable') }, false)).toBe(failed);
    expect(activePollSettled(failed, A1, { ok: false, error: new Error('permission-denied') }, false)).not.toBe(failed);
  });

  it('metadata of another epoch is left alone: App resets it on the change itself', () => {
    expect(activePollSettled(meta, A3, { ok: true, uid: 'uid-A', at: T }, true)).toBe(meta);
    expect(activePollSettled(meta, A3, { ok: false, error: 'x' }, true)).toBe(meta);
  });

  it('only an explicit request ends a refresh; a background request leaves it as it is', () => {
    const refreshing = activePollRefreshStarted(meta, A1);
    expect(activePollSettled(refreshing, A1, { ok: true, uid: 'uid-A', at: T }, false).refreshing).toBe(true);
    expect(activePollSettled(refreshing, A1, { ok: true, uid: 'uid-A', at: T }, true).refreshing).toBe(false);
    expect(activePollSettled(refreshing, A1, { ok: false, error: 'x' }, true).refreshing).toBe(false);
  });

  it('a run that made no request changes nothing — but ends its own refresh', () => {
    expect(activePollSettled(meta, A1, null, false)).toBe(meta);
    const refreshing = activePollRefreshStarted(meta, A1);
    expect(activePollSettled(refreshing, A1, null, true)).toEqual(meta);
  });

  it('a success without a real uid or time is not a success', () => {
    expect(activePollSettled(meta, A1, { ok: true, uid: '', at: T }, false)).toBe(meta);
    expect(activePollSettled(meta, A1, { ok: true, uid: 'uid-A', at: NaN }, false)).toBe(meta);
  });
});

describe('activePollRefreshStarted', () => {
  it('marks a refresh for the current epoch once; another epoch\'s metadata is left alone', () => {
    const meta = initialActivePoll(1);
    const refreshing = activePollRefreshStarted(meta, A1);
    expect(refreshing).toEqual({ ...meta, refreshing: true });
    expect(activePollRefreshStarted(refreshing, A1)).toBe(refreshing);
    expect(activePollRefreshStarted(meta, A3)).toBe(meta);
  });
});

describe('createActivePollFlights — one run per explicit refresh', () => {
  const make = () => {
    const events = [];
    const flights = createActivePollFlights({
      onRefreshStarted: (f) => events.push(['refresh', f.capture.authEpoch]),
      onSettled: (f, outcome) => events.push(['settled', f.capture.authEpoch, f.explicit, outcome]),
    });
    return { flights, events };
  };

  it('a refresh joins the latest unsettled run of its epoch instead of starting another', () => {
    const { flights, events } = make();
    const run = flights.begin(A1);
    expect(flights.joinable(1)).toBe(run);
    flights.markExplicit(run);
    flights.markExplicit(run);
    expect(events).toEqual([['refresh', 1]]);
  });

  it('no run of another epoch, and no settled run, is joinable', () => {
    const { flights } = make();
    const run = flights.begin(A1);
    expect(flights.joinable(3)).toBeNull();
    flights.settle(run, null);
    expect(flights.joinable(1)).toBeNull();
  });

  it('a run begun as explicit reports its refresh at once', () => {
    const { flights, events } = make();
    flights.begin(A1, true);
    expect(events).toEqual([['refresh', 1]]);
  });

  it('settles once: the first outcome stands, later settles are ignored, and done says whether it succeeded', async () => {
    const { flights, events } = make();
    const run = flights.begin(A1);
    flights.markExplicit(run);
    flights.settle(run, { ok: true, uid: 'uid-A', at: T });
    flights.settle(run, { ok: false, error: 'later' });
    flights.settle(run, null);
    expect(events).toEqual([['refresh', 1], ['settled', 1, true, { ok: true, uid: 'uid-A', at: T }]]);
    await expect(run.done).resolves.toBe(true);
    const failed = flights.begin(A1);
    flights.settle(failed, { ok: false, error: 'x' });
    await expect(failed.done).resolves.toBe(false);
  });

  it('a later run is the joinable one; an earlier run settling leaves it so', () => {
    const { flights } = make();
    const first = flights.begin(A1);
    const second = flights.begin(A1);
    expect(flights.joinable(1)).toBe(second);
    flights.settle(first, null);
    expect(flights.joinable(1)).toBe(second);
  });

  it('a settled run cannot take on a refresh', () => {
    const onRefreshStarted = vi.fn();
    const flights = createActivePollFlights({ onRefreshStarted, onSettled: () => {} });
    const run = flights.begin(A1);
    flights.settle(run, null);
    flights.markExplicit(run);
    expect(onRefreshStarted).not.toHaveBeenCalled();
    expect(run.explicit).toBe(false);
  });
});
