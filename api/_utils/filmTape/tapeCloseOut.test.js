// api/_utils/filmTape/tapeCloseOut.test.js
//
// Film Room B1 item 5 — W1, closed-out notes. When a tape's candle pass is
// closed out (the sweep: expired, retry_window_elapsed; the third thrown
// attempt: exhausted, attempts_exhausted), the replay and series coverage
// notes stop saying "awaiting the candle pass" and say how it closed, in the
// writer's words (rebuildOutlook, the reason codes). A tape closed out before
// W1 is corrected by its next merge. (Astra reproduced the stale note through
// the real expiry path.)
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the real passes; only the flag
// module is mocked, by spreading the real one.

import { describe, it, expect, vi } from 'vitest';

vi.setConfig({ testTimeout: 60_000 });
vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return true; },
  CALL_RECORDS_MODE: 'shadow',
}));

import { writeTapeDay } from './writeTapeDay.js';
import { runCandlePass, markRetryWindowElapsed } from './candlePass.js';
import { closedOutNote, closedOutWords, rebuildOutlook } from './tapeMerge.js';
import { makeTapeDb } from './__fixtures__/tapeFirestore.js';
import { seedDay } from './__fixtures__/tapeFixtures.js';
import { flatRows, fetcherOf } from './__fixtures__/tapeBars.js';
import { stalledDay } from './__fixtures__/tagFixtures.js';
import { AWAITING_CANDLES_NOTE } from '../../../src/constants/filmTape.js';

const D = '2026-09-24';
const NIGHT = Date.parse('2026-09-25T02:15:30.000Z');
const MORNING = Date.parse('2026-09-25T11:00:30.000Z');
const LATE = Date.parse('2026-10-09T11:00:30.000Z');                 // 11 sessions after D: the sweep closes it out
const EXPIRED_WORDS = 'the candle pass did not complete within its 10-trading-day window (retry_window_elapsed)';
const EXHAUSTED_WORDS = 'the candle pass did not complete: its attempts are spent (attempts_exhausted)';
const path = (fx) => `agentBattles/${fx.battleId}/tape/${fx.etDate}`;
const anyBars = () => fetcherOf(new Proxy({}, { get: (_, sym) => (typeof sym === 'string' ? flatRows(D, 100) : undefined) }));

async function nightOnly(battleId = 'b-close') {
  const fx = await stalledDay({ battleId });
  const t = makeTapeDb(seedDay({}, fx));
  await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: NIGHT });
  return { fx, t };
}

describe('the words', () => {
  it('the close pass\'s note is the shared constant; a closed-out pass says how it closed, its reason code included', () => {
    expect(AWAITING_CANDLES_NOTE).toBe('awaiting the candle pass');
    expect(closedOutWords({ status: 'expired', reason: 'retry_window_elapsed' })).toBe(EXPIRED_WORDS);
    expect(closedOutWords({ status: 'exhausted', reason: 'attempts_exhausted' })).toBe(EXHAUSTED_WORDS);
  });

  it('a label\'s "awaiting the next candle pass" takes the terminal outlook; other parts stand; a pass still to come changes nothing', () => {
    const note = `${AWAITING_CANDLES_NOTE}; built before the candle inputs changed (checks) — ${rebuildOutlook(true, 'pending')}; no bars for: XOM`;
    expect(closedOutNote(note, { status: 'exhausted', reason: 'attempts_exhausted' })).toBe(`${EXHAUSTED_WORDS}; built before the candle inputs changed (checks) — its attempts are spent, not rebuilt; no bars for: XOM`);
    expect(closedOutNote(note, { status: 'expired', reason: 'retry_window_elapsed' })).toBe(`${EXPIRED_WORDS}; built before the candle inputs changed (checks) — outside its retry window, not rebuilt; no bars for: XOM`);
    for (const status of ['pending', 'partial', 'failed', 'written', 'skipped']) expect(closedOutNote(note, { status }), status).toBe(note);
    expect(closedOutNote(null, { status: 'expired' })).toBeNull();
  });
});

describe('the sweep\'s close-out (expired, retry_window_elapsed) — the real expiry path', () => {
  it('a tape no candle pass ever wrote: both sections now say the window elapsed; their status stays unavailable', async () => {
    const { fx, t } = await nightOnly();
    expect(t.store.get(path(fx)).coverage.replay.note).toBe(AWAITING_CANDLES_NOTE);
    const f = anyBars();
    const s = await runCandlePass({ db: t.db, fetchCandles: f.fetchCandles, clock: () => LATE, startMs: LATE });
    expect(s.expired).toEqual([path(fx)]);
    expect(f.calls).toEqual([]);
    const tape = t.store.get(path(fx));
    expect(tape.passes.candles).toMatchObject({ status: 'expired', reason: 'retry_window_elapsed' });
    for (const section of ['replay', 'series']) {
      expect(tape.coverage[section].note, section).toBe(EXPIRED_WORDS);
      expect(tape.coverage[section].status, section).toBe('unavailable');
    }
  });

  it('markRetryWindowElapsed itself writes the notes in the same targeted update', async () => {
    const { fx, t } = await nightOnly('b-close-direct');
    expect(await markRetryWindowElapsed(t.db, { battleId: fx.battleId, etDate: D }, '2026-10-09T11:00:30.000Z')).toBe(true);
    expect(t.store.get(path(fx)).coverage.series.note).toBe(EXPIRED_WORDS);
  });
});

describe('the third thrown attempt\'s close-out (exhausted, attempts_exhausted)', () => {
  it('the failure record\'s write rewrites the notes; a retryable failure does not', async () => {
    const { fx, t } = await nightOnly('b-exhaust');
    const tape = t.store.get(path(fx));
    t.store.set(path(fx), { ...tape, passes: { ...tape.passes, candles: { ...tape.passes.candles, status: 'failed', attempts: 1, reason: 'error: x' } } });
    t.db.failNextTransactions(1);
    await runCandlePass({ db: t.db, fetchCandles: anyBars().fetchCandles, clock: () => MORNING, startMs: MORNING });
    expect(t.store.get(path(fx)).passes.candles).toMatchObject({ status: 'failed', attempts: 2 });
    expect(t.store.get(path(fx)).coverage.replay.note).toBe(AWAITING_CANDLES_NOTE);       // retryable: still to come
    t.db.failNextTransactions(1);
    await runCandlePass({ db: t.db, fetchCandles: anyBars().fetchCandles, clock: () => MORNING + 86_400_000, startMs: MORNING + 86_400_000 });
    const after = t.store.get(path(fx));
    expect(after.passes.candles).toMatchObject({ status: 'exhausted', attempts: 3, reason: 'attempts_exhausted' });
    for (const section of ['replay', 'series']) expect(after.coverage[section].note, section).toBe(EXHAUSTED_WORDS);
  });
});

describe('a tape closed out BEFORE W1 is corrected by its next merge (the refresh)', () => {
  it('stored terminal with the stale note: the refresh rewrites it; a second refresh writes nothing', async () => {
    const { fx, t } = await nightOnly('b-old-closed');
    const tape = t.store.get(path(fx));
    // as the A1 sweep left it: terminal, the notes untouched
    t.store.set(path(fx), { ...tape, passes: { ...tape.passes, candles: { ...tape.passes.candles, status: 'expired', reason: 'retry_window_elapsed', writtenAt: '2026-10-09T11:00:30.000Z' } } });
    const later = Date.parse('2026-10-20T02:15:30.000Z');
    expect((await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: later })).status).toBe('written');
    const after = t.store.get(path(fx));
    expect(after.coverage.replay.note).toBe(EXPIRED_WORDS);
    expect(after.coverage.series.note).toBe(EXPIRED_WORDS);
    expect(after.passes.candles).toMatchObject({ status: 'expired', reason: 'retry_window_elapsed' });
    expect((await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: later + 60_000 })).status).toBe('unchanged');
  });

  it('a tape still waiting keeps "awaiting the candle pass" through any merge', async () => {
    const { fx, t } = await nightOnly('b-still-waiting');
    await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: NIGHT + 60_000 });
    expect(t.store.get(path(fx)).coverage.replay.note).toBe(AWAITING_CANDLES_NOTE);
  });
});
