// api/_utils/filmTape/tapeReplay.test.js
//
// BA-11 — the corrected replay. The worked example from the Sep 27 review
// (a sale banks 10, reconstruction agrees exactly, neither stock moves:
// gapPoints is 0, not −10); the last-completed-minute sampling; missing inputs
// named and null, never numbers; and THE SCORER IS THE IMPORTED ONE: the
// fenced calculateAssetScoreServer is wrapped in a spy here, and swapping its
// implementation moves every rebuilt number — a local copy of its arithmetic
// could not follow (BUILD_RULES §4; the proof is by the import, not a grep).

import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';

vi.mock('../agentScoring.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, calculateAssetScoreServer: vi.fn(real.calculateAssetScoreServer) };
});

import { calculateAssetScoreServer } from '../agentScoring.js';
import { replayAction, scoredCheck, REPLAY_LABEL } from './tapeReplay.js';
import { sessionBars } from './bars.js';
import { sessionFor } from './tapeTime.js';
import { flatRows, stepRows, sessionRows } from './__fixtures__/tapeBars.js';

const D = '2026-09-24';
const S = sessionFor(D);
const utc = (hhmmss) => `${D}T${hhmmss}.000Z`;
const bars = (rows) => sessionBars(rows, D, S);

const legInputs = (entryPrice, over = {}) => ({
  entryPrice, atr: 10, tier: 'support', direction: null,
  thresholdHistory: { maxMultiplier: 0, minMultiplier: 0 }, thresholdBaseline: { value: entryPrice, basis: 'starting_price' }, sources: {}, ...over,
});
const action = (over = {}) => ({
  key: 'swap:k', tickSeq: 7, at: utc('15:00:30'), symbolOut: 'OUTX', symbolIn: 'INX', lockedPoints: 10,
  replayInputs: { ghost: legInputs(100), bought: legInputs(50, { thresholdBaseline: { value: 50, basis: 'swap_price' } }) },
  replayMissing: [], replayReason: null, subsequentTradesInSlot: 0, ...over,
});
const check = (seq, hhmmss, over = {}) => ({ key: `seq:${seq}`, rowSource: 'tick', tickSeq: seq, at: utc(hhmmss), state: 'no_trigger', stageReached: 'trigger_evaluated', ...over });
const CHECKS = [check(6, '14:45:20'), check(8, '15:15:20'), check(9, '15:30:20'), check(10, '15:45:20', { state: 'degraded_quotes', stageReached: 'quotes_checked' }), check(11, '16:00:20')];
const COMPARABLES = () => ({ SPY: bars(flatRows(D, 500)), RSP: bars(flatRows(D, 170)) });

let realScorer;
beforeAll(async () => { realScorer = (await vi.importActual('../agentScoring.js')).calculateAssetScoreServer; });
afterEach(() => { calculateAssetScoreServer.mockClear(); });

describe('the worked example — gapPoints = (lockedPoints + bought.atClose) − ghost.atClose', () => {
  it('a sale banking 10, reconstruction agreeing exactly, neither stock moving afterward → gapPoints 0, not −10', () => {
    // OUTX at 101 all day: +1% on a support slot = 10 base points, 0.1 × ATR → no badge — exactly the 10 banked.
    const r = replayAction({ action: action(), checks: CHECKS, barsBySymbol: { OUTX: bars(flatRows(D, 101)), INX: bars(flatRows(D, 50)), ...COMPARABLES() }, session: S });
    expect(r.reconciliation.closedLegDelta).toBe(0);
    expect(r.ghost.atSwap).toBe(10);
    expect(r.ghost.atClose).toBe(10);
    expect(r.bought.atClose).toBe(0);
    expect(r.gapPoints).toBe(0);
    // the pre-correction comparison (bought − ghost) would have said −10:
    expect(r.bought.atClose - r.ghost.atClose).toBe(-10);
    expect(r.holdPath.at(-1)).toEqual({ tickSeq: null, at: S.closeMs && new Date(S.closeMs).toISOString(), points: 10 });
    expect(r.swapPath.at(-1).points).toBe(10);
    expect(r).toMatchObject({ basis: 'rebuilt_1m_at_checks', horizon: 'close', hypothetical: true, label: REPLAY_LABEL, lockedPoints: 10 });
    expect(r.missingInputs).toEqual([]);
  });

  it('the bought name rallying after the swap shows up on the swap path; the sold one falling on the hold path', () => {
    const r = replayAction({
      action: action(),
      checks: CHECKS,
      barsBySymbol: { OUTX: bars(stepRows(D, 101, 95, '15:20')), INX: bars(stepRows(D, 50, 52, '15:20')), ...COMPARABLES() },
      session: S,
    });
    // OUTX −5% from entry on support: −50 base, −0.5 ATR no badge; INX +4%: +40.
    expect(r.ghost.atClose).toBe(-50);
    expect(r.bought.atClose).toBe(40);
    expect(r.gapPoints).toBe(100); // (10 + 40) − (−50)
    expect(r.ghost.series.map((p) => p.tickSeq)).toEqual([8, 9, 11]); // after the swap; the degraded check never scored
  });
});

describe('sampling — the battle\'s own checks, at the last completed minute before each', () => {
  it('a check at 10:07:30 ET samples the 10:06 bar close, never 10:07', () => {
    const r = replayAction({
      action: action({ at: utc('13:45:30') }),
      checks: [check(3, '14:07:30')],
      barsBySymbol: { OUTX: bars(stepRows(D, 101, 111, '14:07')), INX: bars(flatRows(D, 50)), ...COMPARABLES() },
      session: S,
    });
    // At 14:07:30Z the 14:06 bar (101) is the last completed; 111 starts with the 14:07 bar.
    expect(r.ghost.series).toEqual([{ tickSeq: 3, at: utc('14:07:30'), points: 10 }]);
    expect(r.ghost.atClose).toBe(125); // +11% on support = 110 base; 1.1 × ATR crosses bagger (+15)
  });

  it('the check that made the swap is the swap sample, never also a later check', () => {
    // tick 7 swapped at 15:00:30 and was captured at 15:00:45 — after the swap instant, in the same check.
    const own = check(7, '15:00:45', { state: 'completed', stageReached: 'scores_marked' });
    const r = replayAction({ action: action(), checks: [own, ...CHECKS], barsBySymbol: { OUTX: bars(flatRows(D, 101)), INX: bars(flatRows(D, 50)), ...COMPARABLES() }, session: S });
    expect(r.ghost.series.map((p) => p.tickSeq)).toEqual([8, 9, 11]);
    expect(r.holdPath.map((p) => p.tickSeq)).toEqual([7, 8, 9, 11, null]); // the swap sample carries the action's tickSeq, once
    // an action with no tickSeq falls back to time alone
    const r2 = replayAction({ action: action({ tickSeq: null }), checks: [own, ...CHECKS], barsBySymbol: { OUTX: bars(flatRows(D, 101)), INX: bars(flatRows(D, 50)), ...COMPARABLES() }, session: S });
    expect(r2.ghost.series.map((p) => p.tickSeq)).toEqual([7, 8, 9, 11]);
  });

  it('only checks whose tick scored the book are samples (the live history ratchets on those alone)', () => {
    expect(scoredCheck(check(1, '14:00:00'))).toBe(true);
    expect(scoredCheck(check(2, '14:00:00', { state: 'degraded_quotes', stageReached: 'quotes_checked' }))).toBe(false);
    expect(scoredCheck({ key: 'run:x', state: 'deferred', at: utc('14:00:00') })).toBe(false);
    expect(scoredCheck({ key: 'seq:4', state: 'no_record', at: null, tickSeq: 4 })).toBe(false);
    expect(scoredCheck({ key: 'eval:e', rowSource: 'entry', state: 'completed', at: utc('14:00:00') })).toBe(true);
  });

  it('the history ratchets across samples: a bagger touched at a check survives a later dip', () => {
    // OUTX: +10% (1.0 × ATR → bagger +15) at 15:15, back to +1% by the close.
    const rows = sessionRows(D, (i, t) => (t >= Date.parse(utc('15:10:00')) && t < Date.parse(utc('15:20:00')) ? 110 : 101));
    const r = replayAction({ action: action(), checks: CHECKS, barsBySymbol: { OUTX: bars(rows), INX: bars(flatRows(D, 50)), ...COMPARABLES() }, session: S });
    expect(r.ghost.series.find((p) => p.tickSeq === 8).points).toBe(115); // 100 base + 15 bagger
    expect(r.ghost.atClose).toBe(25);                                       // 10 base + the bagger kept
  });
});

describe('never guessed — a missing input is named and its numbers are null', () => {
  it('a symbol with no bars: its leg is null, the gap is null, the dependency named', () => {
    const r = replayAction({ action: action(), checks: CHECKS, barsBySymbol: { OUTX: bars(flatRows(D, 101)), ...COMPARABLES() }, session: S });
    expect(r.bought).toBeNull();
    expect(r.swapPath).toBeNull();
    expect(r.gapPoints).toBeNull();
    expect(r.ghost.atClose).toBe(10);
    expect(r.missingInputs).toContain('bars:INX');
  });

  it('a leg whose inputs had no persistent source stays null with the close pass\'s names carried', () => {
    const r = replayAction({
      action: action({ replayInputs: { ghost: null, bought: legInputs(50) }, replayMissing: ['ghost.thresholdBaseline'] }),
      checks: CHECKS, barsBySymbol: { OUTX: bars(flatRows(D, 101)), INX: bars(flatRows(D, 50)), ...COMPARABLES() }, session: S,
    });
    expect(r.ghost).toBeNull();
    expect(r.holdPath).toBeNull();
    expect(r.gapPoints).toBeNull();
    expect(r.reconciliation.closedLegDelta).toBeNull();
    expect(r.missingInputs).toContain('ghost.thresholdBaseline');
  });

  it('an instant before any minute of the session has completed has no price: a visible null, never interpolated', () => {
    // A minute's price is the last COMPLETED bar however far back — so the one
    // honest "no price" is before the session's first bar completes (09:31).
    const early = replayAction({ action: action({ at: utc('13:30:10') }), checks: [check(1, '13:30:50'), check(2, '13:45:20')], barsBySymbol: { OUTX: bars(flatRows(D, 101)), INX: bars(flatRows(D, 50)), ...COMPARABLES() }, session: S });
    expect(early.ghost.atSwap).toBeNull();                 // no minute had completed at 09:30:10
    expect(early.reconciliation.closedLegDelta).toBeNull();
    expect(early.ghost.series).toEqual([{ tickSeq: 1, at: utc('13:30:50'), points: null }, { tickSeq: 2, at: utc('13:45:20'), points: 10 }]);
    expect(early.holdPath[0]).toEqual({ tickSeq: 7, at: utc('13:30:10'), points: null });
    // the bought name is scored FROM the swap: it has no swap sample to miss (review L2-F2)
    expect(early.missingInputs).toEqual(expect.arrayContaining(['price:OUTX@swap', 'price:OUTX@1', 'price:INX@1']));
    expect(early.missingInputs).not.toContain('price:INX@swap');
    expect(early.gapPoints).toBe(0);                       // the close is still known
  });

  it('crypto is out of scope: no replay at all (the close pass stated why)', () => {
    expect(replayAction({ action: action({ replayReason: 'crypto_not_supported', replayInputs: null }), checks: CHECKS, barsBySymbol: {}, session: S })).toBeNull();
  });
});

describe('reconciliation and comparables', () => {
  it('closedLegDelta is the rebuilt ghost at the sale minus the banked points', () => {
    const r = replayAction({ action: action({ lockedPoints: 8.5 }), checks: CHECKS, barsBySymbol: { OUTX: bars(flatRows(D, 101)), INX: bars(flatRows(D, 50)), ...COMPARABLES() }, session: S });
    expect(r.reconciliation.closedLegDelta).toBe(1.5);
  });

  it('boughtVsEvidence: the rebuilt price against the first later evidence stamp that carries the bought name', () => {
    const withEvidence = [...CHECKS.slice(0, 1), check(8, '15:15:20', { evalId: 'e8', evidence: { INX: { px: 50.2, chg: 0.4 } } }), ...CHECKS.slice(2)];
    const r = replayAction({ action: action(), checks: withEvidence, barsBySymbol: { OUTX: bars(flatRows(D, 101)), INX: bars(flatRows(D, 50)), ...COMPARABLES() }, session: S });
    expect(r.reconciliation.boughtVsEvidence).toEqual({ tickSeq: 8, evalId: 'e8', at: utc('15:15:20'), recordedPx: 50.2, rebuiltPx: 50, pxDelta: -0.2, recordedChg: 0.4, rebuiltChg: 0, chgDelta: -0.4 });
  });

  it('market and sector change from the swap to the close, per symbol', () => {
    const r = replayAction({
      action: action({ symbolOut: 'AAPL', symbolIn: 'JPM', replayInputs: { ghost: legInputs(100), bought: legInputs(50) } }),
      checks: CHECKS,
      barsBySymbol: { AAPL: bars(flatRows(D, 101)), JPM: bars(flatRows(D, 50)), SPY: bars(stepRows(D, 500, 505, '16:00')), RSP: bars(flatRows(D, 170)), XLK: bars(flatRows(D, 200)) },
      session: S, sectors: { AAPL: 'XLK', JPM: 'XLF' },
    });
    expect(r.marketChangeAfter).toEqual({ SPY: 1, RSP: 0 });
    expect(r.sectorChangeAfter).toEqual({ XLK: 0, XLF: null });
    expect(r.missingInputs).toContain('bars:XLF');
  });
});

describe('THE SCORER IS THE IMPORTED ONE (BUILD_RULES §4)', () => {
  it('every rebuilt point comes from calculateAssetScoreServer, called with the leg\'s own inputs and empty extremes', () => {
    replayAction({ action: action(), checks: CHECKS, barsBySymbol: { OUTX: bars(flatRows(D, 101)), INX: bars(flatRows(D, 50)), ...COMPARABLES() }, session: S });
    // the sold leg: swap + 3 scored later checks + close; the bought leg: 3 later checks + close
    expect(calculateAssetScoreServer).toHaveBeenCalledTimes(9);
    const [asset, priceChange, history, extremes, thresholdPriceChange] = calculateAssetScoreServer.mock.calls[0];
    // a tiered battle's mode-resolved stamp is null — the scorer resolves CONVICTION_MULTIPLIERS[tier] as live
    expect(asset).toEqual({ symbol: 'OUTX', baseATR: 10, tier: 'support', direction: null, tierMultiplier: null });
    expect(priceChange).toBeCloseTo(1, 10);
    expect(history).toEqual({ maxMultiplier: 0, minMultiplier: 0 });
    expect(extremes).toEqual({});
    expect(thresholdPriceChange).toBeCloseTo(1, 10);
  });

  it('the rebuild carries the mode-resolved tier stamp: null (tiered) scores by tier; a flat stamp is honoured', () => {
    const run = (tierStamp) => replayAction({ action: action(), checks: CHECKS, barsBySymbol: { OUTX: bars(flatRows(D, 101)), INX: bars(flatRows(D, 50)), ...COMPARABLES() }, session: S, tierStamp });
    const tiered = run(undefined);
    expect(calculateAssetScoreServer.mock.calls.every(([a]) => a.tierMultiplier === null)).toBe(true);
    expect(tiered.ghost.atClose).toBe(10); // +1% on support (1.0×) = 10
    calculateAssetScoreServer.mockClear();
    const stamped = run(2.0);
    expect(calculateAssetScoreServer.mock.calls.every(([a]) => a.tierMultiplier === 2.0)).toBe(true);
    expect(stamped.ghost.atClose).toBe(20); // the scorer honoured the stamp over the tier
  });

  it('swap the imported scorer and every rebuilt number follows it — a local copy could not', () => {
    calculateAssetScoreServer.mockImplementation(() => ({ totalPoints: 777, history: { maxMultiplier: 0, minMultiplier: 0 } }));
    try {
      const r = replayAction({ action: action(), checks: CHECKS, barsBySymbol: { OUTX: bars(flatRows(D, 101)), INX: bars(flatRows(D, 50)), ...COMPARABLES() }, session: S });
      expect(r.ghost.atClose).toBe(777);
      expect(r.bought.atClose).toBe(777);
      expect(r.gapPoints).toBe(10);                      // (10 + 777) − 777
      expect(r.reconciliation.closedLegDelta).toBe(767); // 777 − 10
    } finally {
      calculateAssetScoreServer.mockImplementation(realScorer);
    }
  });
});
