// src/utils/reviewAvailability.test.js
//
// The hub contract (spec §11, BA-17) — one fixture per state per stage
// (Stage 1: ready / pending / unavailable / active; Stage 3: ready / pending /
// unavailable / active), the exact three-key shape, and the read budget:
// Stage 1 reads NOTHING; Stage 3 reads the final-day tape exactly once.
//
// Both flags are mocked explicitly (getter form), so none of these rows moves
// when either flag is flipped; the pins live in src/config/filmTapeFlags.test.js.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const flags = vi.hoisted(() => ({ v2: false, writer: false }));
vi.mock('../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_ROOM_V2_ENABLED() { return flags.v2; },
  get FILM_TAPE_WRITE_ENABLED() { return flags.writer; },
}));

import { getReviewAvailability, closePassStillScheduled, owningPassDate } from './reviewAvailability';

const MON_1605_EDT = '2026-09-28T20:05:00.000Z';   // Monday, 16:05 ET — a fullday battle's completion
const MON_1900_EDT = Date.parse('2026-09-28T23:00:00.000Z');
const TUE_0221_UTC = Date.parse('2026-09-29T02:21:00.000Z'); // after 02:15 + 300 s — the pass has had its full run
const WED_0220_UTC = Date.parse('2026-09-30T02:20:00.000Z'); // Tuesday's pass, too, has had its full run
const THU = Date.parse('2026-10-01T15:00:00.000Z');

const base = (over = {}) => ({
  id: 'battle-1', status: 'completed', completedAt: MON_1605_EDT, ownerId: 'u1',
  timing: { tradingDays: ['2026-09-28'] }, dailyReviews: [], reviewPending: false, ...over,
});

const KEYS = ['availability', 'ready', 'target'];

function recorder(tape) {
  const calls = [];
  const readTape = async (battleId, etDate) => { calls.push([battleId, etDate]); return tape; };
  return { readTape, calls };
}

beforeEach(() => { flags.v2 = false; flags.writer = false; });

describe('the returned object — exactly { ready, target, availability } (BA-17, invariant 8)', () => {
  it.each([
    ['stage 1', false],
    ['stage 3', true],
  ])('%s returns exactly three keys, for every state', async (_label, v2) => {
    flags.v2 = v2; flags.writer = true;
    const r = recorder({ passes: { close: { status: 'written' } } });
    for (const b of [base({ dailyReviews: [{ date: 'x' }] }), base({ reviewPending: true }), base(), base({ status: 'active', completedAt: null }), null, {}]) {
      const out = await getReviewAvailability(b, { readTape: r.readTape, now: MON_1900_EDT });
      expect(Object.keys(out).sort()).toEqual(KEYS);
      expect(typeof out.ready).toBe('boolean');
      expect(['ready', 'pending', 'unavailable']).toContain(out.availability);
      expect(out.target === null || out.target === 'filmRoom').toBe(true);
    }
  });

  it('never carries a score, a result, a stage or a reason, even when the battle has them', async () => {
    const out = await getReviewAvailability(base({ dailyReviews: [{ grade: 'A', summary: 'won big' }], result: 'win', scoreState: { currentScore: 125 } }));
    expect(JSON.stringify(out)).not.toMatch(/win|125|grade|summary|stage|reason/);
  });
});

describe('Stage 1 — FILM_ROOM_V2_ENABLED off: from the battle document, no read', () => {
  it('ready: completed AND the legacy review exists', async () => {
    const r = recorder(null);
    expect(await getReviewAvailability(base({ dailyReviews: [{ date: '2026-09-28' }] }), { readTape: r.readTape }))
      .toEqual({ ready: true, target: 'filmRoom', availability: 'ready' });
    expect(r.calls).toEqual([]);
  });

  it('pending: completed, no review yet, and the batch-review queue flag is set', async () => {
    const r = recorder(null);
    expect(await getReviewAvailability(base({ reviewPending: true }), { readTape: r.readTape }))
      .toEqual({ ready: false, target: 'filmRoom', availability: 'pending' });
    expect(r.calls).toEqual([]);
  });

  it('unavailable: completed, no review, and nothing scheduled to write one', async () => {
    expect(await getReviewAvailability(base({ reviewPending: false })))
      .toEqual({ ready: false, target: 'filmRoom', availability: 'unavailable' });
    expect(await getReviewAvailability(base({ reviewPending: undefined })))
      .toEqual({ ready: false, target: 'filmRoom', availability: 'unavailable' });
  });

  it('active: not completed is never ready, even with a filed daily review (presence alone is not readiness)', async () => {
    const r = recorder({ passes: { close: { status: 'written' } } });
    expect(await getReviewAvailability(base({ status: 'active', completedAt: null, dailyReviews: [{ date: 'd' }], reviewPending: true }), { readTape: r.readTape }))
      .toEqual({ ready: false, target: 'filmRoom', availability: 'unavailable' });
    expect(r.calls).toEqual([]);
  });

  it('the writer flag alone changes nothing for the hub (Stage 2)', async () => {
    flags.writer = true;
    const r = recorder({ passes: { close: { status: 'written' } } });
    expect(await getReviewAvailability(base(), { readTape: r.readTape }))
      .toEqual({ ready: false, target: 'filmRoom', availability: 'unavailable' });
    expect(r.calls).toEqual([]);
  });

  it('no battle → not ready, no target', async () => {
    expect(await getReviewAvailability(null)).toEqual({ ready: false, target: null, availability: 'unavailable' });
    expect(await getReviewAvailability({ status: 'completed' })).toEqual({ ready: false, target: null, availability: 'unavailable' });
  });
});

describe('Stage 3 — FILM_ROOM_V2_ENABLED on: one bounded read of tape/{finalEtDate}', () => {
  beforeEach(() => { flags.v2 = true; flags.writer = true; });

  it('ready: completed AND the final-day tape\'s close pass is written — read once, at the last trading day', async () => {
    const r = recorder({ passes: { close: { status: 'written' }, candles: { status: 'pending' } } });
    const b = base({ timing: { tradingDays: ['2026-09-24', '2026-09-25', '2026-09-28'] } });
    expect(await getReviewAvailability(b, { readTape: r.readTape, now: THU }))
      .toEqual({ ready: true, target: 'filmRoom', availability: 'ready' });
    expect(r.calls).toEqual([['battle-1', '2026-09-28']]);
  });

  it('pending: completed today, no tape yet, tonight\'s close pass still to run', async () => {
    const r = recorder(null);
    expect(await getReviewAvailability(base(), { readTape: r.readTape, now: MON_1900_EDT }))
      .toEqual({ ready: false, target: 'filmRoom', availability: 'pending' });
    expect(r.calls).toHaveLength(1);
  });

  it('unavailable: completed with no tape and no pass scheduled (a pre-backfill battle is never "pending")', async () => {
    expect(await getReviewAvailability(base(), { readTape: recorder(null).readTape, now: THU }))
      .toEqual({ ready: false, target: 'filmRoom', availability: 'unavailable' });
    // After tonight's pass has had its full run and wrote nothing, Tuesday's
    // pass re-selects the completion (its window opens at Monday's start) and
    // tapes the final day, as the writer does — so pending until that pass,
    // too, has had its full run (BA-28; this row said unavailable at
    // TUE_0221_UTC under the owning-pass-only rule):
    expect(await getReviewAvailability(base(), { readTape: recorder(null).readTape, now: TUE_0221_UTC }))
      .toEqual({ ready: false, target: 'filmRoom', availability: 'pending' });
    expect(await getReviewAvailability(base(), { readTape: recorder(null).readTape, now: WED_0220_UTC }))
      .toEqual({ ready: false, target: 'filmRoom', availability: 'unavailable' });
    // A close pass that FAILED is not written:
    expect(await getReviewAvailability(base(), { readTape: recorder({ passes: { close: { status: 'failed' } } }).readTape, now: THU }))
      .toEqual({ ready: false, target: 'filmRoom', availability: 'unavailable' });
  });

  it('active: not completed — unavailable, and no read is spent', async () => {
    const r = recorder({ passes: { close: { status: 'written' } } });
    expect(await getReviewAvailability(base({ status: 'active', completedAt: null }), { readTape: r.readTape, now: MON_1900_EDT }))
      .toEqual({ ready: false, target: 'filmRoom', availability: 'unavailable' });
    expect(r.calls).toEqual([]);
  });

  it('a read that throws is "no tape" — never an error surfaced to the hub', async () => {
    const readTape = async () => { throw new Error('permission-denied'); };
    expect(await getReviewAvailability(base(), { readTape, now: THU }))
      .toEqual({ ready: false, target: 'filmRoom', availability: 'unavailable' });
  });

  it('with the writer dark, nothing will write the tape — so never "pending"', async () => {
    flags.writer = false;
    expect(await getReviewAvailability(base(), { readTape: recorder(null).readTape, now: MON_1900_EDT }))
      .toEqual({ ready: false, target: 'filmRoom', availability: 'unavailable' });
  });

  it('a flat6/tournament battle is never "pending": its pass writes skipped_mode, never a readable tape (BA-3)', async () => {
    const r = recorder(null);
    expect(await getReviewAvailability(base({ gameMode: 'baggerbomb_tournament' }), { readTape: r.readTape, now: MON_1900_EDT }))
      .toEqual({ ready: false, target: 'filmRoom', availability: 'unavailable' });
  });

  it('ignores the legacy review entirely — a dailyReviews entry never makes Stage 3 ready', async () => {
    expect(await getReviewAvailability(base({ dailyReviews: [{ date: 'd' }], reviewPending: true }), { readTape: recorder(null).readTape, now: THU }))
      .toEqual({ ready: false, target: 'filmRoom', availability: 'unavailable' });
  });
});

describe('closePassStillScheduled — the pass that tapes the completion, by the schedule (15 2 * * 2-6 UTC + maxDuration)', () => {
  it('a weekday completion is pending until 02:15 UTC + 300 s the next UTC day', () => {
    const done = Date.parse(MON_1605_EDT);
    expect(closePassStillScheduled(done, MON_1900_EDT)).toBe(true);
    expect(closePassStillScheduled(done, Date.parse('2026-09-29T02:19:59.000Z'))).toBe(true);
    expect(closePassStillScheduled(done, Date.parse('2026-09-29T02:20:00.000Z'))).toBe(false);
  });
  it('a completion on an earlier ET day is not tonight\'s', () => {
    expect(closePassStillScheduled(Date.parse(MON_1605_EDT), THU)).toBe(false);
  });
  it('the ET date, not the UTC date: 21:30 EDT is still Monday\'s pass', () => {
    const late = Date.parse('2026-09-29T01:30:00.000Z'); // Mon 21:30 EDT
    expect(closePassStillScheduled(late, late + 60_000)).toBe(true);
  });
  it('a weekend completion is taped by the next session\'s pass (review L3-F1/F2): pending until Monday night\'s pass has run', () => {
    const sat = Date.parse('2026-09-26T16:00:00.000Z');
    expect(owningPassDate(sat)).toBe('2026-09-28');
    expect(closePassStillScheduled(sat, sat + 3_600_000)).toBe(true);
    expect(closePassStillScheduled(sat, Date.parse('2026-09-29T02:19:59.000Z'))).toBe(true);
    expect(closePassStillScheduled(sat, Date.parse('2026-09-29T02:20:00.000Z'))).toBe(false);
  });
  it('a holiday completion is never promised the holiday night (no pass runs then) — it is taped by the next session\'s pass', () => {
    const thanksgiving = Date.parse('2026-11-26T15:00:00.000Z'); // Thu 10:00 EST, a market holiday
    expect(owningPassDate(thanksgiving)).toBe('2026-11-27');
    // past the hour a Thursday pass would have ended: still pending, for Friday's
    expect(closePassStillScheduled(thanksgiving, Date.parse('2026-11-27T03:00:00.000Z'))).toBe(true);
    expect(closePassStillScheduled(thanksgiving, Date.parse('2026-11-28T02:20:00.000Z'))).toBe(false);
  });
  it('a completion after tonight\'s pass started belongs to the next session\'s pass', () => {
    const late = Date.parse('2026-09-29T03:30:00.000Z'); // Mon 23:30 EDT, after Monday's 22:15 pass
    expect(owningPassDate(late)).toBe('2026-09-29');
    expect(closePassStillScheduled(late, late + 60_000)).toBe(true);
    expect(closePassStillScheduled(late, Date.parse('2026-09-30T02:20:00.000Z'))).toBe(false);
  });
});
