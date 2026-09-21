// api/_utils/intraday/postClose.test.js — contract §5.4–§5.5 at calcVersion 2.
//
// The post-close rule, end to end through the real sweep calculation: EODHD's
// 2026-09-21 answers make `priceAsOf` the cutoff for `volume` and for session
// high/low — but ONLY up to the close. After 16:00 ET the vendor's `volume`,
// `high` and `low` stop at the session total while `lastTradeTime` keeps
// running on extended-hours prints, so a post-close quote's clock would stamp
// a session aggregate with an instant it is not cumulative to. §5.5 therefore
// freezes every session aggregate at the last PRE-CLOSE accepted observation
// and lets only the price facts and bucket completion move.
//
// The defect these rows are written against, stated concretely: without the
// rule, the 16:00 auction print (19.1 M shares on the founder's AAPL fixture,
// 42.9 % of the day) would land in the accumulator at the auction price AND
// stamp `volumeCutoffAsOf` with an after-hours instant — a VWAP estimate the
// validator would then align against a reference bar that never saw it.

import { describe, it, expect } from 'vitest';
import { runSweepCalc } from './sweepCalc.js';
import { evaluateIntraday, CONSUMERS, VERDICT } from './eligibility.js';
import { sessionKeys } from './buckets.js';
import { renderIntradayDiagnosticLines } from '../../../src/data/intradayDiagnosticCopy.js';
import * as CONFIG from '../intradayConfig.js';
import { SEP17, etDateOfEdt, sessionOfFixture, obsAt } from '../__fixtures__/intradaySessions.js';

const SYM = 'AAPL';
const ACTIONABLE = new Set([SYM]);
/** A Thanksgiving-Friday early close: the calendar's own 13:00, not 16:00. */
const EARLY = { ...SEP17, etDate: '2026-11-27', isEarlyClose: true, closeMs: SEP17.openMs + 210 * 60_000, sessionLenMin: 210 };
const earlyEtDateOf = () => EARLY.etDate;
const earlySessionOf = (d) => (d === EARLY.etDate ? EARLY : null);

const priceAt = (m) => Number((330 + Math.sin(m / 11) * 2.5).toFixed(4));
const volumeAt = (m) => 700_000 * (m + 1);

/** One sweep of one symbol through the real §5.3 step-5/6 calculation. */
function sweep(state, minute, over = {}) {
  const session = over.session || SEP17;
  const obs = obsAt(session, minute, {
    sym: SYM,
    price: over.price ?? priceAt(minute),
    volume: over.volume ?? volumeAt(minute),
    high: over.high ?? priceAt(minute) + 1.5,
    low: over.low ?? priceAt(minute) - 1.5,
    open: 330,
    extra: { averageVolume: 60_000_000, previousClose: 329, change: 1, changePercent: 0.3, size: 100 },
  });
  const out = runSweepCalc({
    prevSnapshotSymbols: state.snapshotSymbols,
    universeState: state.universeState,
    actionableDocs: state.actionableDocs,
    observations: { [SYM]: obs },
    actionableSet: ACTIONABLE,
    cryptoSet: new Set(),
    session,
    etDateOf: over.etDateOf || etDateOfEdt,
    sessionOf: over.sessionOf || sessionOfFixture,
    nowMs: obs.availableAt,
    sweepId: `sw${minute}`,
    generation: state.generation + 1,
    config: CONFIG,
  });
  return {
    snapshotSymbols: out.snapshotSymbols,
    universeState: out.universeState,
    actionableDocs: out.actionableDocs,
    generation: state.generation + 1,
    counters: out.counters,
    anomalies: out.anomalies,
    outcomes: out.outcomes,
  };
}

const fresh = () => ({ snapshotSymbols: {}, universeState: { accumulators: {} }, actionableDocs: {}, generation: 0 });

/** Run the continuous session minute by minute, to `lastMinute` inclusive. */
function runSession(lastMinute = 389, over = {}) {
  let st = fresh();
  for (let m = 0; m <= lastMinute; m++) st = sweep(st, m, over);
  return st;
}

describe('§5.5 post-close — the session aggregates freeze at the last pre-close observation', () => {
  it('the auction quote leaves the accumulator byte-identical, freezes volume / sessionHL / vwap with their cutoffs, advances the price facts, and counts postClose', () => {
    const before = runSession(389);
    const accBefore = JSON.stringify(before.universeState.accumulators[SYM]);
    const factsBefore = before.snapshotSymbols[SYM];

    // 16:00:00.000 — the closing auction: a 19.1 M-share jump at a price
    // 1.5 % away from the last continuous print.
    const after = sweep(before, 390, { price: 336.91, volume: volumeAt(389) + 19_122_063 });

    expect(after.outcomes[SYM].outcome).toBe('post_close');
    expect(after.counters.postClose).toBe(1);
    expect(after.counters.accepted).toBe(0);
    expect(after.counters.unchangedCount).toBe(0);
    expect(after.anomalies.held).toBe(0);
    expect(after.anomalies.rejected).toBe(0);

    // The accumulator: byte-identical, and still the same object.
    expect(after.universeState.accumulators[SYM]).toBe(before.universeState.accumulators[SYM]);
    expect(JSON.stringify(after.universeState.accumulators[SYM])).toBe(accBefore);

    // The four session aggregates: values AND cutoffs unchanged.
    const factsAfter = after.snapshotSymbols[SYM];
    for (const key of ['vwap', 'sessionHL', 'volume', 'volumePace']) {
      expect(factsAfter.indicators[key]).toEqual(factsBefore.indicators[key]);
    }
    expect(factsAfter.indicators.volume.value).toBe(volumeAt(389));
    expect(factsAfter.indicators.volume.cutoff).toBe(SEP17.openMs + 389 * 60_000);
    expect(factsAfter.indicators.sessionHL.cutoff).toBe(SEP17.openMs + 389 * 60_000);
    expect(factsAfter.indicators.vwap.estimateCutoff).toBe(SEP17.openMs + 389 * 60_000);
    // Had the auction been applied, the estimate would have moved: 19.1 M
    // shares at 336.91 against a 273 M-share session is not a rounding error.
    expect(factsAfter.indicators.vwap.value).toBe(factsBefore.indicators.vwap.value);

    // The price facts ARE the latest quote.
    expect(factsAfter.price.value).toBe(336.91);
    expect(factsAfter.price.priceAsOf).toBe(SEP17.closeMs);
    expect(factsAfter.observationId).not.toBe(factsBefore.observationId);
  });

  it('every post-close sweep of the collection window repeats the freeze; lastAcceptedAsOf stays inside the session', () => {
    let st = runSession(389);
    const frozen = JSON.stringify(st.snapshotSymbols[SYM].indicators.vwap);
    // The poller runs to close + 30 min (§5.1): six more sweeps, each of
    // which must freeze again rather than only the first.
    let postCloseSweeps = 0;
    for (const m of [390, 395, 400, 405, 410, 415]) {
      st = sweep(st, m, { price: 337 + m / 1000, volume: volumeAt(389) + 19_122_063 + m });
      postCloseSweeps += st.counters.postClose;
      expect(JSON.stringify(st.snapshotSymbols[SYM].indicators.vwap)).toBe(frozen);
    }
    expect(postCloseSweeps).toBe(6);
    expect(st.universeState.accumulators[SYM].lastAcceptedAsOf).toBeLessThan(SEP17.closeMs);
    expect(st.universeState.accumulators[SYM].lastAcceptedAsOf).toBe(SEP17.openMs + 389 * 60_000);
    expect(st.universeState.accumulators[SYM].lastAcceptedVolume).toBe(volumeAt(389));
    expect(st.universeState.accumulators[SYM].degraded).toBe(false);
  });

  it('every log entry carries a confirmed estimateCutoff strictly inside the session — including the post-close ones', () => {
    let st = runSession(389);
    for (const m of [390, 400, 415]) st = sweep(st, m, { price: 337, volume: volumeAt(389) + 19_122_063 });
    const log = st.actionableDocs[SYM].log;
    expect(log).toHaveLength(393);
    for (const e of log) {
      expect(Number.isFinite(e.estimateCutoff)).toBe(true);
      expect(e.estimateCutoff).toBeLessThan(SEP17.closeMs);
      expect(e.estimateCutoff).toBeGreaterThanOrEqual(SEP17.openMs);
      expect(e.volumeCutoffAsOf).toBe(e.estimateCutoff);
      expect(e.experimental).toBe(false);
    }
    // The post-close entries repeat the frozen estimate while their own
    // priceAsOf runs on — that difference is the record of the rule working.
    expect(log.at(-1).priceAsOf).toBeGreaterThan(SEP17.closeMs);
    expect(log.at(-1).estimate).toBe(log[389].estimate);
    expect(log.at(-1).estimateCutoff).toBe(log[389].estimateCutoff);
  });

  it('bucket completion still happens: the last bucket closes on the 15:59 trade and the auction price is never written to it', () => {
    const before = runSession(389);
    const { lastKey } = sessionKeys(SEP17);
    expect(before.actionableDocs[SYM].ring.buckets.find((b) => b.key === lastKey).status).toBe('open');
    const after = sweep(before, 390, { price: 336.91, volume: volumeAt(389) + 19_122_063 });
    const last = after.actionableDocs[SYM].ring.buckets.find((b) => b.key === lastKey);
    expect(last.status).toBe('completed');
    expect(last.close).toBe(priceAt(389));
    expect(last.close).not.toBe(336.91);
    expect(last.maxPriceAsOf).toBe(SEP17.openMs + 389 * 60_000);
    expect(after.actionableDocs[SYM].ring.buckets.some((b) => b.key > lastKey)).toBe(false);
  });

  it('an early-close session uses the calendar\'s own 13:00: the same instant is mid-session on a full day', () => {
    const over = { session: EARLY, etDateOf: earlyEtDateOf, sessionOf: earlySessionOf };
    let st = fresh();
    for (let m = 0; m <= 209; m++) st = sweep(st, m, over);
    const frozen = st.snapshotSymbols[SYM].indicators.volume;
    const at13 = sweep(st, 210, { ...over, price: 340, volume: volumeAt(209) + 9_000_000 });
    expect(at13.outcomes[SYM].outcome).toBe('post_close');
    expect(at13.snapshotSymbols[SYM].indicators.volume).toEqual(frozen);
    expect(at13.snapshotSymbols[SYM].price.value).toBe(340);
    // The identical minute on a full session is 12:00 ET — ordinary trading.
    const full = sweep(runSession(209), 210);
    expect(full.outcomes[SYM].outcome).toBe('accepted');
    expect(full.snapshotSymbols[SYM].indicators.volume.value).toBe(volumeAt(210));
  });

  it('with no pre-close observation to carry, the aggregates are absent with `post_close` — never the post-close quote\'s own volume', () => {
    // A poller that starts inside the [close, close + 30 min] tail: the first
    // observation this symbol ever gets today is already post-close.
    const st = sweep(fresh(), 400, { price: 337, volume: 273_000_000 });
    const facts = st.snapshotSymbols[SYM];
    expect(st.counters.postClose).toBe(1);
    for (const key of ['vwap', 'sessionHL', 'volume', 'volumePace']) {
      expect(facts.indicators[key]).toMatchObject({ status: 'absent', value: null, reason: 'post_close' });
    }
    expect(facts.indicators.volume.cutoff).toBeNull();
    expect(facts.indicators.vwap.estimateCutoff).toBeNull();
    // …and the price facts are still the quote.
    expect(facts.price.value).toBe(337);

    // The player reads a phrase, not a code (§9.1 — the one copy table).
    const { verdicts } = evaluateIntraday(facts, { nowMs: SEP17.closeMs + 11 * 60_000, consumer: CONSUMERS.DISPLAY });
    expect(verdicts.volume).toMatchObject({ state: VERDICT.INELIGIBLE, reason: 'post_close' });
    const lines = renderIntradayDiagnosticLines({ ...facts, indicators: Object.fromEntries(Object.entries(facts.indicators).map(([k, v]) => [k, { ...v, verdict: verdicts[k] }])) }, { timeText: () => '4:11 PM' });
    expect(lines).toContain('Session volume unavailable · no reading before the close');
  });

  it('a carried block from ANOTHER session is never reused: yesterday\'s facts do not become today\'s frozen aggregate', () => {
    const stale = { ...runSession(389).snapshotSymbols[SYM], sessionEtDate: '2026-09-16' };
    const st = runSweepCalc({
      prevSnapshotSymbols: { [SYM]: stale },
      universeState: { accumulators: {} },
      actionableDocs: {},
      observations: { [SYM]: obsAt(SEP17, 400, { sym: SYM, price: 337, volume: 273_000_000, high: 338, low: 330, open: 330 }) },
      actionableSet: ACTIONABLE, cryptoSet: new Set(), session: SEP17,
      etDateOf: etDateOfEdt, sessionOf: sessionOfFixture,
      nowMs: SEP17.closeMs + 26 * 60_000, sweepId: 'sw400', generation: 1, config: CONFIG,
    });
    expect(st.snapshotSymbols[SYM].indicators.volume).toMatchObject({ status: 'absent', reason: 'post_close' });
    expect(st.snapshotSymbols[SYM].indicators.volume.value).not.toBe(stale.indicators.volume.value);
  });
});

describe('§5.4 / §8.3 mid-session — the effects the confirmed cutoffs unlock', () => {
  const MID = 120; // 11:30 ET
  const midFacts = () => runSession(MID).snapshotSymbols[SYM];

  it('the VWAP estimate is no longer experimental, and its verdict is eligible rather than display_only', () => {
    const facts = midFacts();
    expect(facts.indicators.vwap.experimental).toBe(false);
    expect(facts.indicators.vwap.reason).toBeNull();
    expect(facts.indicators.vwap.estimateCutoff).toBe(SEP17.openMs + MID * 60_000);
    const { verdicts } = evaluateIntraday(facts, { nowMs: SEP17.openMs + (MID + 5) * 60_000, consumer: CONSUMERS.DISPLAY });
    expect(verdicts.vwap).toMatchObject({ state: VERDICT.ELIGIBLE, reason: null });
    expect(Object.values(verdicts).map((v) => v.state)).not.toContain(VERDICT.DISPLAY_ONLY);
  });

  it('sessionHL is eligible for display mid-session, aged from its OWN cutoff', () => {
    const facts = midFacts();
    const cutoff = facts.indicators.sessionHL.cutoff;
    expect(cutoff).toBe(SEP17.openMs + MID * 60_000);
    const { verdicts } = evaluateIntraday(facts, { nowMs: cutoff + 10 * 60_000, consumer: CONSUMERS.DISPLAY });
    expect(verdicts.sessionHL).toEqual({ state: VERDICT.ELIGIBLE, reason: null, consumer: 'display', ageMs: 10 * 60_000 });
    // Still age-bounded: past the display window it is stale, not eligible.
    const late = evaluateIntraday(facts, { nowMs: cutoff + CONFIG.CONSUMER_MAX_AGE_MS.display + 1, consumer: CONSUMERS.DISPLAY });
    expect(late.verdicts.sessionHL).toMatchObject({ state: VERDICT.INELIGIBLE, reason: 'stale' });
  });

  it('volumePace is present mid-session, by the §5.4 formula with elapsed measured AT the volume cutoff', () => {
    const facts = midFacts();
    const pace = facts.indicators.volumePace;
    expect(pace.status).toBe('ready');
    expect(pace.elapsedAtCutoffMin).toBe(MID);
    expect(pace.cutoff).toBe(SEP17.openMs + MID * 60_000);
    // volume / (averageVolume × elapsed / sessionLen) — the restored formula.
    expect(pace.value).toBeCloseTo(volumeAt(MID) / (60_000_000 * (MID / 390)), 9);
    const { verdicts } = evaluateIntraday(facts, { nowMs: pace.cutoff + 60_000, consumer: CONSUMERS.DISPLAY });
    expect(verdicts.volumePace).toMatchObject({ state: VERDICT.ELIGIBLE, reason: null });
  });
});
