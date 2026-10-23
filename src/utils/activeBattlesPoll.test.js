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
  // review T5aR-2: App returns before the call without a uid; this pins the helper's own contract.
  it('an unresolved capture matches a non-empty uid and nothing else', () => {
    expect(pollCaptureMatches(UNRESOLVED, 'uid-A')).toBe(true);
    expect(pollCaptureMatches(UNRESOLVED, '')).toBe(false);
    expect(pollCaptureMatches(UNRESOLVED, undefined)).toBe(false);
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

/** The metadata as App wires it: the flights say whether a settle ends the refresh (`endsRefresh`). */
function wired(epoch = 1) {
  const state = { meta: initialActivePoll(epoch) };
  const flights = createActivePollFlights({
    onRefreshStarted: (flight) => { state.meta = activePollRefreshStarted(state.meta, flight.capture); },
    onSettled: (flight, outcome, endsRefresh) => { state.meta = activePollSettled(state.meta, flight.capture, outcome, endsRefresh); },
  });
  return { state, flights };
}
const B2 = Object.freeze({ resolved: true, uid: 'uid-B', authEpoch: 2 });

describe('a refresh joins a run still out, even after a NEWER run settled (review T2-3)', () => {
  it('an explicit run still in flight stays joinable after a newer background run settles', () => {
    const { flights } = wired();
    const r1 = flights.begin(A1);
    flights.markExplicit(r1);
    const r2 = flights.begin(A1);
    flights.settle(r2, { ok: true, uid: 'uid-A', at: T });
    expect(r1.settled).toBe(false);
    expect(flights.joinable(1)).toBe(r1);
  });

  it('with several runs out, the newest UNSETTLED run of the epoch is the one joined; begin() never joins', () => {
    const { flights } = wired();
    const runs = [flights.begin(A1), flights.begin(A1), flights.begin(A1)];
    expect(new Set(runs).size).toBe(3);
    flights.settle(runs[2], null);
    expect(flights.joinable(1)).toBe(runs[1]);
    flights.settle(runs[1], null);
    expect(flights.joinable(1)).toBe(runs[0]);
    flights.settle(runs[0], null);
    expect(flights.joinable(1)).toBeNull();
  });

  it('a run of another epoch is never joined, whatever else is out', () => {
    const { flights } = wired(2);
    const old = flights.begin(A1);
    const current = flights.begin(B2);
    expect(flights.joinable(2)).toBe(current);
    flights.settle(current, null);
    expect(old.settled).toBe(false);
    expect(flights.joinable(2)).toBeNull();
  });
});

describe('a refresh ends with the NEWEST explicit run of its epoch (review T2-4)', () => {
  it('an older explicit run settling does not end `refreshing` while a newer explicit run is out', async () => {
    const { state, flights } = wired();
    const r1 = flights.begin(A1);
    flights.markExplicit(r1);
    const r2 = flights.begin(A1);
    flights.markExplicit(r2);
    flights.settle(r1, { ok: true, uid: 'uid-A', at: T });
    expect(state.meta.refreshing).toBe(true);
    let second = false;
    r2.done.then(() => { second = true; });
    await Promise.resolve();
    expect(second).toBe(false);
    flights.settle(r2, { ok: true, uid: 'uid-A', at: T + 1000 });
    expect(state.meta.refreshing).toBe(false);
  });

  it('the same when the older run fails over a pre-refresh error: nothing says the refresh is over', () => {
    const { state, flights } = wired();
    flights.settle(flights.begin(A1), { ok: false, error: new Error('unavailable') });
    expect(state.meta.status).toBe('error');
    const r1 = flights.begin(A1);
    flights.markExplicit(r1);
    const r2 = flights.begin(A1);
    flights.markExplicit(r2);
    flights.settle(r1, { ok: false, error: new Error('unavailable') });
    expect(state.meta.refreshing).toBe(true);
    flights.settle(r2, { ok: true, uid: 'uid-A', at: T });
    expect(state.meta).toMatchObject({ status: 'ready', refreshing: false, error: null });
  });

  it('an older explicit run settling LATE does not end a newer refresh begun after it', () => {
    const { state, flights } = wired();
    const r1 = flights.begin(A1);
    flights.markExplicit(r1);
    const r2 = flights.begin(A1);
    flights.markExplicit(r2);
    flights.settle(r2, { ok: true, uid: 'uid-A', at: T });
    expect(state.meta.refreshing).toBe(false);
    const r3 = flights.begin(A1);
    flights.markExplicit(r3);
    flights.settle(r1, { ok: true, uid: 'uid-A', at: T - 1000 });
    expect(state.meta.refreshing).toBe(true);
    flights.settle(r3, { ok: true, uid: 'uid-A', at: T + 1000 });
    expect(state.meta.refreshing).toBe(false);
  });

  it('an older explicit run that stalls cannot hold the refresh open; a background run never ends one; another epoch\'s does not either', () => {
    const one = wired();
    const stalled = one.flights.begin(A1);
    one.flights.markExplicit(stalled);
    const newer = one.flights.begin(A1);
    one.flights.markExplicit(newer);
    one.flights.settle(newer, { ok: true, uid: 'uid-A', at: T });
    expect(stalled.settled).toBe(false);
    expect(one.state.meta.refreshing).toBe(false);

    const two = wired();
    const explicit = two.flights.begin(A1);
    two.flights.markExplicit(explicit);
    two.flights.settle(two.flights.begin(A1), { ok: true, uid: 'uid-A', at: T });
    expect(two.state.meta.refreshing).toBe(true);

    const three = wired(2);
    const old = three.flights.begin(A1);
    three.flights.markExplicit(old);
    const current = three.flights.begin(B2);
    three.flights.markExplicit(current);
    three.flights.settle(current, { ok: true, uid: 'uid-B', at: T });
    expect(three.state.meta.refreshing).toBe(false);
  });
});

describe('an older run\'s failure never downgrades a newer success; "as of" is a run\'s start (review T2-5, metadata only)', () => {
  const ready = () => activePollSettled(initialActivePoll(1), A1, { ok: true, uid: 'uid-A', at: T + 1000 }, false);

  it('a failure whose run BEGAN before the retained success leaves the status ready and the error clear — and still ends its refresh', () => {
    expect(activePollSettled(ready(), A1, { ok: false, error: new Error('late'), at: T }, false))
      .toMatchObject({ status: 'ready', error: null, lastSuccessfulAt: T + 1000, ownerUid: 'uid-A', ownerEpoch: 1 });
    const refreshing = activePollRefreshStarted(ready(), A1);
    expect(activePollSettled(refreshing, A1, { ok: false, error: new Error('late'), at: T }, true))
      .toMatchObject({ status: 'ready', error: null, refreshing: false });
  });

  it('a failure begun AFTER the retained success is real news; one that names no start, or comes first, reaches error', () => {
    const later = activePollSettled(ready(), A1, { ok: false, error: new Error('real'), at: T + 2000 }, false);
    expect(later).toMatchObject({ status: 'error', lastSuccessfulAt: T + 1000 });
    expect(later.error.message).toBe('real');
    expect(activePollSettled(ready(), A1, { ok: false, error: new Error('blip') }, false)).toMatchObject({ status: 'error' });
    expect(activePollSettled(initialActivePoll(1), A1, { ok: false, error: new Error('first'), at: T }, false))
      .toMatchObject({ status: 'error', lastSuccessfulAt: null, ownerUid: null });
  });

  it('a success stands as given: an older run landing last stamps its own (earlier) start', () => {
    expect(activePollSettled(ready(), A1, { ok: true, uid: 'uid-A', at: T }, false)).toMatchObject({ status: 'ready', lastSuccessfulAt: T });
  });

  it('a stale failure that changes nothing a reader shows renders nothing: the same metadata object comes back, so App does not re-render (review T5-6)', () => {
    const meta = ready();
    expect(activePollSettled(meta, A1, { ok: false, error: new Error('late'), at: T }, false)).toBe(meta);
  });

  it('a failure that began in the very millisecond of the retained success is not older than it: it is recorded (review T5-6)', () => {
    const next = activePollSettled(ready(), A1, { ok: false, error: new Error('tie'), at: T + 1000 }, false);
    expect(next).toMatchObject({ status: 'error', lastSuccessfulAt: T + 1000 });
    expect(next.error.message).toBe('tie');
  });
});

describe('"Refreshing" ends however the explicit refresh ends (R-S3-3: `refreshing` true only for an explicit refresh; review T5-6)', () => {
  it('a Retry that fails the way the request before it did still ends: the error stays, "Refreshing" does not', () => {
    const { state, flights } = wired();
    flights.settle(flights.begin(A1), { ok: false, error: new Error('unavailable') });
    expect(state.meta).toMatchObject({ status: 'error', refreshing: false });
    const retry = flights.begin(A1, true);
    expect(state.meta.refreshing).toBe(true);
    flights.settle(retry, { ok: false, error: new Error('unavailable') });
    expect(state.meta).toMatchObject({ status: 'error', refreshing: false });
  });

  it('the interval tick that starts while a Retry is out is a BACKGROUND run: it does not hold the refresh open, before or after it settles', () => {
    const { state, flights } = wired();
    const retry = flights.begin(A1, true);
    const intervalTick = flights.begin(A1);
    expect(state.meta.refreshing).toBe(true);
    flights.settle(retry, { ok: true, uid: 'uid-A', at: T });
    expect(state.meta.refreshing).toBe(false);
    flights.settle(intervalTick, { ok: true, uid: 'uid-A', at: T + 1000 });
    expect(state.meta.refreshing).toBe(false);
  });
});

describe('the retained list is tagged with the uid the request queried (R-S3-3; review T5-6)', () => {
  it('a first run whose capture names no uid yet (Firebase has not answered) still tags its success with the uid it queried', () => {
    const next = activePollSettled(initialActivePoll(0), UNRESOLVED, { ok: true, uid: 'uid-A', at: T }, false);
    expect(next).toMatchObject({ status: 'ready', ownerUid: 'uid-A', ownerEpoch: 0, lastSuccessfulAt: T });
  });
});
