// api/_utils/evalPool.test.js
//
// Capacity Build 1, Part 1 — the dispatcher on its own (pure: no I/O, no
// clock). The handler-level rows (capture scope per battle, the per-battle
// catch, the run record) are in api/cron/agent-evaluate.pool.test.js.
//
// Each item is a battle stand-in whose `run` waits on a gate the row opens,
// so "in flight" is exact: started and not yet released.

import { describe, it, expect } from 'vitest';
import { clampPoolK, poolStartCutoffMs, poolGroupOf, runEvalPool, EVAL_POOL_K_MAX } from './evalPool.js';

const flush = async (n = 5) => { for (let i = 0; i < n; i++) await Promise.resolve(); };

/** A controllable world: `started` in start order, `inFlight` now, `release(id)` ends one run. */
function world(ids, { groups = {} } = {}) {
  const gates = new Map();
  const started = [];
  const inFlightNow = new Set();
  let peak = 0;
  const items = ids.map((id) => ({ id, group: groups[id] ?? null }));
  const run = (item) => {
    started.push(item.id);
    inFlightNow.add(item.id);
    peak = Math.max(peak, inFlightNow.size);
    return new Promise((resolve, reject) => {
      gates.set(item.id, { resolve: () => { inFlightNow.delete(item.id); resolve(); }, reject: (e) => { inFlightNow.delete(item.id); reject(e); } });
    });
  };
  return {
    items, run, started, inFlightNow,
    get peak() { return peak; },
    release: async (id) => { gates.get(id).resolve(); await flush(); },
    fail: async (id, err) => { gates.get(id).reject(err); await flush(); },
  };
}

describe('clampPoolK — the setting as the dispatcher reads it', () => {
  it('an integer 1–8 is used as is', () => {
    for (let k = 1; k <= 8; k++) expect(clampPoolK(k)).toBe(k);
    expect(EVAL_POOL_K_MAX).toBe(8);
  });
  it('anything else reads as 1: 0, 9, 1.5, "3", NaN, null, undefined, -2, Infinity', () => {
    for (const v of [0, 9, 1.5, '3', NaN, null, undefined, -2, Infinity, {}, [2]]) expect(clampPoolK(v)).toBe(1);
  });
});

describe('poolStartCutoffMs / poolGroupOf', () => {
  it('K = 1 keeps TIME_BUDGET_MS (the loop\'s rule); K > 1 takes the pool cutoff', () => {
    const cfg = { timeBudgetMs: 290_000, poolCutoffMs: 200_000 };
    expect(poolStartCutoffMs(1, cfg)).toBe(290_000);
    expect(poolStartCutoffMs(2, cfg)).toBe(200_000);
    expect(poolStartCutoffMs(8, cfg)).toBe(200_000);
  });
  it('review PL-7: a malformed pool cutoff (NaN, 0, negative, past the budget, a string) reads as TIME_BUDGET_MS — never "defer everything"', () => {
    for (const bad of [NaN, 0, -5, 300_000, '200000', null, undefined, Infinity]) {
      expect(poolStartCutoffMs(2, { timeBudgetMs: 290_000, poolCutoffMs: bad }), String(bad)).toBe(290_000);
    }
    expect(poolStartCutoffMs(2, { timeBudgetMs: 290_000, poolCutoffMs: 290_000 })).toBe(290_000);
  });
  it('the affinity key is a non-empty string groupId (the field resolveTournamentContext reads), else none', () => {
    expect(poolGroupOf({ gameMode: 'baggerbomb_tournament', groupId: 'grp-7' })).toBe('grp-7');
    expect(poolGroupOf({ groupId: '' })).toBeNull();
    expect(poolGroupOf({ groupId: 7 })).toBeNull();
    expect(poolGroupOf({})).toBeNull();
    expect(poolGroupOf(null)).toBeNull();
  });
});

describe('runEvalPool — K = 1 is the sequential loop', () => {
  it('one at a time, in order; the start rule is asked once before EACH start', async () => {
    const w = world(['a', 'b', 'c']);
    const asked = [];
    const done = runEvalPool({ items: w.items, k: 1, run: w.run, mayStart: () => { asked.push(w.started.length); return true; } });
    await flush();
    expect(w.started).toEqual(['a']);
    await w.release('a');
    expect(w.started).toEqual(['a', 'b']);
    await w.release('b');
    await w.release('c');
    const out = await done;
    expect(asked).toEqual([0, 1, 2]);
    expect(out).toMatchObject({ dispatched: 3, maxInFlight: 1, deferred: [], stopped: false });
  });

  it('the first "no" defers every item not yet started, in order, and nothing after it starts', async () => {
    const w = world(['a', 'b', 'c', 'd']);
    let open = true;
    const stops = [];
    const done = runEvalPool({ items: w.items, k: 1, run: w.run, mayStart: () => open, onStop: (d) => stops.push(d.map((i) => i.id)) });
    await flush();
    await w.release('a');
    open = false;
    await w.release('b');
    const out = await done;
    expect(w.started).toEqual(['a', 'b']);
    expect(stops).toEqual([['c', 'd']]);
    expect(out.deferred.map((i) => i.id)).toEqual(['c', 'd']);
    expect(out.stopped).toBe(true);
  });

  it('a "no" with nothing waiting defers nothing — the rule is asked only while an item waits', async () => {
    const w = world(['a']);
    let asks = 0;
    const done = runEvalPool({ items: w.items, k: 1, run: w.run, mayStart: () => { asks += 1; return asks === 1; } });
    await flush();
    await w.release('a');
    const out = await done;
    expect(asks).toBe(1);
    expect(out).toMatchObject({ deferred: [], stopped: false, dispatched: 1 });
  });

  it('affinity never binds at K = 1: group-mates run back to back in rotation order', async () => {
    const w = world(['a1', 'a2', 'b1'], { groups: { a1: 'g', a2: 'g' } });
    const done = runEvalPool({ items: w.items, k: 1, run: w.run, mayStart: () => true, groupOf: (i) => i.group });
    for (const id of ['a1', 'a2', 'b1']) { await flush(); await w.release(id); }
    await done;
    expect(w.started).toEqual(['a1', 'a2', 'b1']);
  });
});

describe('runEvalPool — K > 1', () => {
  for (const k of [2, 3]) {
    it(`K = ${k} keeps at most ${k} in flight, and reaches ${k}`, async () => {
      const ids = Array.from({ length: 7 }, (_, i) => `b${i + 1}`);
      const w = world(ids);
      const stats = { dispatched: 0, maxInFlight: 0 };
      const done = runEvalPool({ items: w.items, k, run: w.run, mayStart: () => true, stats });
      await flush();
      expect(w.inFlightNow.size).toBe(k);
      // release in a scrambled order; never more than k at once
      while (w.started.length < ids.length || w.inFlightNow.size > 0) {
        const next = [...w.inFlightNow].at(-1);
        await w.release(next);
        expect(w.inFlightNow.size).toBeLessThanOrEqual(k);
      }
      const out = await done;
      expect(w.peak).toBe(k);
      expect(out).toMatchObject({ dispatched: 7, maxInFlight: k, deferred: [] });
      expect(stats).toEqual({ dispatched: 7, maxInFlight: k });
      expect(w.started).toEqual(ids); // started in rotation order
    });
  }

  it('no start after the cutoff; in-flight items are never deferred; deferred = never started, in rotation order', async () => {
    const w = world(['a', 'b', 'c', 'd', 'e']);
    let open = true;
    const done = runEvalPool({ items: w.items, k: 2, run: w.run, mayStart: () => open });
    await flush();
    expect(w.started).toEqual(['a', 'b']);
    await w.release('a');
    expect(w.started).toEqual(['a', 'b', 'c']);
    open = false;
    await w.release('c'); // the next start is refused: d, e deferred; b still running
    expect(w.started).toEqual(['a', 'b', 'c']);
    let settled = false;
    done.then(() => { settled = true; });
    await flush();
    expect(settled).toBe(false); // b is in flight — the pool waits for it
    await w.release('b');
    const out = await done;
    expect(out.deferred.map((i) => i.id)).toEqual(['d', 'e']);
    expect(out.dispatched).toBe(3);
  });

  it('awaits every in-flight run before it resolves', async () => {
    const w = world(['a', 'b', 'c']);
    let settled = false;
    const done = runEvalPool({ items: w.items, k: 3, run: w.run, mayStart: () => true }).then((x) => { settled = true; return x; });
    await flush();
    await w.release('b');
    await w.release('a');
    expect(settled).toBe(false);
    await w.release('c');
    await done;
    expect(settled).toBe(true);
  });

  it('League affinity: group-mates never overlap; a passed-over mate starts when its mate finishes, ahead of later items', async () => {
    // rotation: a1(g1) a2(g1) b1(g2) c1 c2 — K = 2
    const w = world(['a1', 'a2', 'b1', 'c1', 'c2'], { groups: { a1: 'g1', a2: 'g1', b1: 'g2' } });
    const overlaps = [];
    const run = (item) => {
      const mates = [...w.inFlightNow].filter((id) => w.items.find((x) => x.id === id).group && w.items.find((x) => x.id === id).group === item.group);
      if (mates.length) overlaps.push([item.id, ...mates]);
      return w.run(item);
    };
    const done = runEvalPool({ items: w.items, k: 2, run, mayStart: () => true, groupOf: (i) => i.group });
    await flush();
    expect(w.started).toEqual(['a1', 'b1']); // a2 passed over: its mate a1 is in flight
    await w.release('b1');
    expect(w.started).toEqual(['a1', 'b1', 'c1']); // a2 still blocked by a1; c1 goes
    await w.release('a1');
    expect(w.started).toEqual(['a1', 'b1', 'c1', 'a2']); // a2 now, AHEAD of c2
    await w.release('c1');
    await w.release('a2');
    await w.release('c2');
    await done;
    expect(overlaps).toEqual([]);
  });

  it('a run that REJECTS stops new starts, lets the others finish, then rejects with that error; nothing is deferred', async () => {
    const w = world(['a', 'b', 'c', 'd']);
    const stops = [];
    const done = runEvalPool({ items: w.items, k: 2, run: w.run, mayStart: () => true, onStop: (d) => stops.push(d) });
    const outcome = done.then(() => 'resolved', (e) => e);
    await flush();
    const boom = new Error('defect in the handler catch');
    await w.fail('a', boom);
    expect(w.started).toEqual(['a', 'b']); // c is not started
    await w.release('b');
    expect(await outcome).toBe(boom);
    expect(stops).toEqual([]);
  });

  it('a run that throws synchronously is a rejection like any other', async () => {
    const boom = new Error('sync');
    const out = await runEvalPool({ items: [{ id: 'x' }], k: 2, run: () => { throw boom; }, mayStart: () => true }).catch((e) => e);
    expect(out).toBe(boom);
  });

  it('review PL-2: a run that rejects with a FALSY reason is still a failure — nothing more starts, the pool rejects', async () => {
    for (const reason of [0, '', false, undefined]) {
      const w = world(['a', 'b', 'c']);
      const outcome = runEvalPool({ items: w.items, k: 1, run: w.run, mayStart: () => true }).then(() => 'resolved', (e) => ({ rejected: e }));
      await flush();
      await w.fail('a', reason);
      const out = await outcome;
      expect(out, `reason ${String(reason)}`).not.toBe('resolved');
      expect(w.started, `reason ${String(reason)}`).toEqual(['a']);
    }
  });

  it('review PL-2: a start rule that THROWS while a battle is in flight stops new starts and rejects once it finishes — never hangs', async () => {
    const w = world(['a', 'b', 'c']);
    let asks = 0;
    const boom = new Error('start rule defect');
    const outcome = runEvalPool({ items: w.items, k: 2, run: w.run, mayStart: () => { asks += 1; if (asks === 3) throw boom; return true; } })
      .then(() => 'resolved', (e) => e);
    await flush();
    expect(w.started).toEqual(['a', 'b']);
    await w.release('a'); // the third ask throws while b is in flight
    expect(w.started).toEqual(['a', 'b']);
    let settled = false;
    outcome.then(() => { settled = true; });
    await flush();
    expect(settled).toBe(false); // b still runs
    await w.release('b');
    expect(await outcome).toBe(boom);
  });

  it('review PL-2: the helper clamps K itself — 0, NaN or 9 run one at a time', async () => {
    for (const k of [0, NaN, 9]) {
      const w = world(['a', 'b']);
      const done = runEvalPool({ items: w.items, k, run: w.run, mayStart: () => true });
      await flush();
      expect(w.inFlightNow.size, `k ${k}`).toBe(1);
      await w.release('a'); await w.release('b');
      expect(await done).toMatchObject({ dispatched: 2, maxInFlight: 1 });
    }
  });

  it('review TI-14: with two runs rejecting, the pool rejects with the FIRST; an undefined reason becomes an Error', async () => {
    const w = world(['a', 'b']);
    const outcome = runEvalPool({ items: w.items, k: 2, run: w.run, mayStart: () => true }).then(() => 'resolved', (e) => e);
    await flush();
    const first = new Error('first');
    await w.fail('a', first);
    await w.fail('b', new Error('second'));
    expect(await outcome).toBe(first);
    const w2 = world(['x']);
    const out2 = runEvalPool({ items: w2.items, k: 1, run: w2.run, mayStart: () => true }).then(() => 'resolved', (e) => e);
    await flush();
    await w2.fail('x', undefined);
    const e2 = await out2;
    expect(e2).toBeInstanceOf(Error);
  });

  it('review TI-14: onStop runs AT the refusal, while battles are still in flight — not when they finish', async () => {
    const w = world(['a', 'b', 'c', 'd']);
    let open = true;
    const stops = [];
    const done = runEvalPool({ items: w.items, k: 2, run: w.run, mayStart: () => open, onStop: (d) => stops.push({ deferred: d.map((i) => i.id), inFlight: [...w.inFlightNow] }) });
    await flush();
    open = false;
    await w.release('a'); // the refusal happens here, with b still running
    expect(stops).toEqual([{ deferred: ['c', 'd'], inFlight: ['b'] }]);
    await w.release('b');
    await done;
  });

  it('an empty list resolves at once without asking the start rule', async () => {
    let asked = 0;
    const out = await runEvalPool({ items: [], k: 3, run: async () => {}, mayStart: () => { asked += 1; return true; } });
    expect(asked).toBe(0);
    expect(out).toMatchObject({ dispatched: 0, maxInFlight: 0, deferred: [] });
  });
});
