// api/_utils/filmTape/__fixtures__/screenFixtures.js
//
// Film Room A2 — the SCREEN's fixture days, produced through the A1 passes
// exactly as the A1 suites produce theirs: the capture writer composes every
// tick (makeTick), the evaluator's own stamp composers build the evidence,
// candidates and heard stamps, the close pass (writeTapeDay) writes the tape
// at night over an in-memory store, and the candle pass (runCandlePass) fills
// the replay, the plan prices and the series from fixture 1-minute bars the
// next morning. No network; no production data — every id, uid and number
// here is invented.
//
//   sep23Day   — Sep-23-SHAPED (the day the design was drawn from): 23 checks
//                from 10:15 to 3:45 ET (a plan created, six plan-pending
//                checks, twelve completed — two of them held by default after a
//                failed model call, one a SWAP — and four no-trigger checks);
//                three swaps (two platform-rule exits by stagnation, one the
//                agent's own); three directive cards (committed and heard, no
//                change, not filed); plans; recorded rationale; evidence
//                stamps; intraday diagnostic views present; NO run records, so
//                the checks section is partial; a completed one-day battle the
//                platform recorded as a win.
//   emptyDay   — a completed one-day battle with no checks at all: no ticks,
//                no evaluations, no trades; the opponent score was never
//                recorded, so the result is unavailable, and the platform's
//                completion message reads "Result: Draw.".
//
// The JSON the screen suites load is these days' output, committed under
// src/screens/filmRoomV2/__fixtures__/ and kept honest by
// api/_utils/filmTape/screenFixtures.test.js, which rebuilds them through the
// passes and compares (BUILD_RULES §9 — a hand-made tape would agree with the
// screen while disagreeing with the product).

import { makeTick, makeEntry, tradeOf, receiptOf, battleDoc, seedDay, STAGES_TO, OWNER } from './tapeFixtures.js';
import { sessionRows, fetcherOf } from './tapeBars.js';
import { makeTapeDb } from './tapeFirestore.js';
import { composeEvidenceStamp } from '../../tickStamps.js';
import { writeTapeDay } from '../writeTapeDay.js';
import { runCandlePass } from '../candlePass.js';

export const SEP23 = '2026-09-23';
/** The close pass's night run (22:15 ET + 30 s) and the candle pass's morning (07:00 ET + 30 s). */
export const SEP23_NIGHT = Date.parse('2026-09-24T02:15:30.000Z');
export const SEP23_MORNING = Date.parse('2026-09-24T11:00:30.000Z');
export const EMPTY_DAY = '2026-09-28';
export const EMPTY_NIGHT = Date.parse('2026-09-29T02:15:30.000Z');
export const EMPTY_MORNING = Date.parse('2026-09-29T11:00:30.000Z');

const iso = (ms) => new Date(ms).toISOString();
const at = (date, hhmmss) => Date.parse(`${date}T${hhmmss}.000Z`);
const OPEN_MS = at(SEP23, '13:30:00');

// ── the day's prices: one deterministic 1-minute path per symbol ─────────────
//
// open × (1 + drift·(minutes / 390) + wave·sin(minutes / period)). DE rises
// into 2:00 PM while PLTR falls into it, so swap 2's sale and fill differ in
// sign (the sold name's bar sits above its recorded exit; the bought name's
// sits below its recorded fill).
const PATHS = {
  INTC: { open: 31.24, drift: 0.006, wave: 0.002, period: 37 },
  AMD: { open: 164.3, drift: 0.004, wave: 0.003, period: 41 },
  META: { open: 612.4, drift: 0.002, wave: 0.002, period: 53 },
  ETN: { open: 387.1, drift: -0.005, wave: 0.0015, period: 47 },
  DE: { open: 466.2, drift: 0.008, wave: 0.0005, period: 61 },
  MSFT: { open: 500.6, drift: -0.006, wave: 0.001, period: 43 },
  PLTR: { open: 160.4, drift: -0.012, wave: 0.0008, period: 59 },
  CRWD: { open: 403.2, drift: 0.003, wave: 0.002, period: 39 },
  PANW: { open: 383.6, drift: 0.02, wave: 0.001, period: 45 },
  MU: { open: 126.5, drift: 0.004, wave: 0.004, period: 33 },
  SPY: { open: 598.2, drift: 0.003, wave: 0.0008, period: 71 },
  RSP: { open: 182.1, drift: 0.002, wave: 0.0007, period: 67 },
  XLK: { open: 262.4, drift: 0.004, wave: 0.0012, period: 57 },
  XLC: { open: 112.6, drift: 0.002, wave: 0.001, period: 49 },
  XLI: { open: 151.3, drift: -0.002, wave: 0.0009, period: 63 },
};
const r2 = (v) => Math.round(v * 100) / 100;
/** The close of the minute that STARTS at minute i of the session. */
export const pathPrice = (sym, i) => {
  const p = PATHS[sym];
  return r2(p.open * (1 + p.drift * (i / 390) + p.wave * Math.sin(i / p.period)));
};
/** The price the platform's delayed quote shows at `ms` — the path ~16 minutes earlier (BA-38's quote delay). */
const quoteAt = (sym, ms) => pathPrice(sym, Math.max(0, Math.floor((ms - OPEN_MS) / 60_000) - 16));
/** The bar price the tape samples at `ms`: the close of the last minute that completed at or before it. */
const barAt = (sym, ms) => pathPrice(sym, Math.max(0, Math.floor((ms - OPEN_MS) / 60_000) - 1));

/** The fixture 1-minute bars for every symbol of a day (BTC is crypto and never fetched). */
export function sep23Bars(date = SEP23) {
  const out = {};
  for (const sym of Object.keys(PATHS)) out[sym] = sessionRows(date, (i) => pathPrice(sym, i), { volume: 1000 + (sym.length * 137) });
  return out;
}

// ── the battle-day ───────────────────────────────────────────────────────────

const HELD0 = ['INTC', 'AMD', 'META', 'ETN', 'DE', 'MSFT', 'BTC'];
const SCORES = [11, -79, -89, -83, -49, -41, -35, -37, -55, -56, -55, -60, -75, -92, -91, -65, -61, -75, -69, -73, -54, -46, -47];
const scoresAt = (total, seq) => ({ active: total + 6, banked: -6, total, opponent: -60 - seq, bankedBadgePoints: 0 });

/** One evidence stamp per held stock at a check, at the platform's (delayed) quote — what the agent was given. */
function evidenceAtCheck(held, ms) {
  const stocks = held.filter((s) => s !== 'BTC');
  return composeEvidenceStamp({
    assetScores: stocks.map((s, i) => ({ symbol: s, priceChange: r2((quoteAt(s, ms) / PATHS[s].open - 1) * 100), multiplier: 0.2 + i / 10 })),
    prices: Object.fromEntries(stocks.map((s) => [s, { current: quoteAt(s, ms) }])),
    momentumData: {
      vwap: Object.fromEntries(stocks.map((s, i) => [s, { vwapDeviation: r2(0.1 + i / 20) }])),
      rankings: Object.fromEntries(stocks.map((s, i) => [s, { bBandwidthPercentile: 30 + i * 7, nr7Flag: i === 2 }])),
    },
    stockRegimes: Object.fromEntries(stocks.map((s, i) => [s, i % 2 ? 'trending' : 'ranging'])),
    riskStatus: Object.fromEntries(stocks.map((s) => [s, { action: 'HOLD' }])),
  });
}

const RATIONALE = {
  8: ['Software strength should carry PLTR through 158 by the early afternoon.', 'The plan from the open is still waiting on an approval, so the book is held as it stands. PLTR leads the names tracked by five-day move and sits just under 158. MSFT has not moved since the open and is the slot to free first.'],
  10: ['A hold above 158 at the next check is the trigger for PLTR; MSFT stays the exit candidate.', 'Nothing in the book has crossed a threshold since the last check. PLTR pulled back from 158 and is holding the pullback on lighter volume.'],
  11: ['With MSFT gone by rule, CRWD is now a holding; PLTR remains the entry being waited on.', 'The platform rule exited MSFT before this check ran and placed CRWD in the slot. PLTR tagged 158 and pulled back again; a 15-minute close above it comes before rotating DE out.'],
  12: ['PLTR above 158.50 into the afternoon would confirm; MU is a second candidate.', 'ETN and DE are the two names not moving with the market. Both have held their levels, so there is no exit trigger yet.'],
  14: ['PLTR is building a base; one more check without a break and the plan acts on a hold above it.', 'The midday range is tightening in PLTR. CRWD is consolidating under 407. DE has not moved in three checks.'],
  15: ['A hold above 159 at 2:00 is the trigger: DE out, PLTR in.', 'PLTR is pressing 159 with volume building into the hour, and DE has still not moved.'],
  16: ['PLTR took the slot; PANW is next in line if it holds over 386.', 'PLTR held into the check, so DE goes out and PLTR comes in, on the plan carried since noon. PANW sits at 385.'],
  17: ['PANW is one level away; ETN is the slot it would take.', 'PANW is holding over 385 after the push. ETN is flat for the session while the market has moved.'],
  18: ['PANW through 386 on the quote; confirm on the next check before rotating ETN.', 'PANW printed through 386 on the platform quote this check. Confirmation comes on the next check rather than a single print.'],
  19: ['If PANW holds 386 at 3:00, ETN goes out for it.', 'PANW held 386 into this check and ETN is still flat, so the plan for 3:00 is ETN out and PANW in.'],
};
const CANDIDATES = {
  8: [
    { symbol: 'PLTR', direction: 'potential_entry', signalSummary: 'PLTR is leading software on volume into midday.', threshold: 'holds above 158.00 at the next check', signalSource: 'relative_strength' },
    { symbol: 'MSFT', direction: 'potential_exit', signalSummary: 'MSFT has gone flat since the open while the rest of the book moves.', threshold: 'loses 497.50', signalSource: 'stagnation' },
  ],
  10: [
    { symbol: 'PLTR', direction: 'potential_entry', signalSummary: 'PLTR pulled back from 158 and is holding the pullback on lighter volume.', threshold: 'holds above 158.00 at the next check', signalSource: 'relative_strength' },
    { symbol: 'CRWD', direction: 'potential_entry', signalSummary: 'CRWD pushing toward its morning high with volume rising into it.', threshold: 'above 406.50', signalSource: 'breakout' },
  ],
  12: [{ symbol: 'MU', direction: 'potential_entry', signalSummary: 'MU is bid with the memory group.', threshold: 'close above 128.00', signalSource: 'sector' }],
  17: [
    { symbol: 'PANW', direction: 'potential_entry', signalSummary: 'PANW holding over 385 after the push.', threshold: 'holds above 386.00', signalSource: 'breakout' },
    { symbol: 'ETN', direction: 'potential_exit', signalSummary: 'ETN flat for the session while the market moved.', threshold: 'loses 385.00', signalSource: 'stagnation' },
  ],
};

/** The three swaps: [tickSeq, instant, out, in, tier, slotIndex, source, exitReason, lockedPoints]. */
const SWAPS = [
  [11, at(SEP23, '16:45:08'), 'MSFT', 'CRWD', 'support', 1, 'risk_manager', 'stagnation', -13],
  [16, at(SEP23, '18:00:05'), 'DE', 'PLTR', 'support', 0, 'haiku', 'haiku_decision', -9],
  [20, at(SEP23, '19:00:10'), 'ETN', 'PANW', 'core', 1, 'risk_manager', 'stagnation', -2],
];
const ENTRY_PRICE = { MSFT: 500.6, DE: 466.2, ETN: 387.1 };

export async function sep23Day({ battleId = 'b-sep23-fixture' } = {}) {
  const D = SEP23;
  const ticks = [];
  const evaluations = [];
  let held = [...HELD0];
  for (let seq = 1; seq <= 23; seq += 1) {
    const slotMs = at(D, '14:15:00') + (seq - 1) * 15 * 60_000;
    const capturedAtMs = slotMs + 20_000;
    const kind = seq === 1 ? 'gameplan_created' : seq <= 7 ? 'gameplan_pending' : seq <= 19 ? 'completed' : 'no_trigger';
    const failed = seq === 9 || seq === 13;
    const swap = SWAPS.find((s) => s[0] === seq) || null;
    const evalId = kind === 'completed' ? `${battleId}:e${seq}` : null;
    const verdicts = Object.fromEntries(held.map((s) => [s, swap && swap[2] === s && swap[7] === 'stagnation' ? { action: 'SWAP_OUT', reason: 'stagnation' } : { action: 'HOLD', reason: null }]));
    const decision = kind === 'completed'
      ? (failed ? { original: null, final: 'HOLD', holdKind: 'default_failure' } : { original: seq === 16 ? 'SWAP' : 'HOLD', final: seq === 16 ? 'SWAP' : 'HOLD', holdKind: null })
      : null;
    const actions = swap ? [{
      source: swap[6], exitReason: swap[7], symbolOut: swap[2], symbolIn: swap[3], swappedOutAt: iso(swap[1]), lockedPoints: swap[8],
      // the BOUGHT name's fill, at the platform's delayed quote (incomingAsset.swapPrice)
      entryPrice: quoteAt(swap[3], swap[1]),
    }] : [];
    ticks.push(await makeTick({
      battleId, tickSeq: seq, capturedAtMs,
      exitReason: kind,
      stages: kind === 'gameplan_created' ? ['quotes_checked', 'scores_marked', 'risk_evaluated', 'proposal_handled', 'gameplan_handled'] : STAGES_TO[kind],
      evalId,
      scores: scoresAt(SCORES[seq - 1], seq),
      verdicts,
      decision,
      modelFailureClass: failed ? 'timeout' : null,
      guardrail: { evaluated: false, deployedCount: 0 },
      actions,
      controls: kind === 'completed' && seq >= 15 && !failed ? { rendered: 'resolved', directiveThreadId: 'th-sep23', directiveSuppressed: null } : null,
      evidenceKeys: kind === 'completed' && !failed ? held.filter((s) => s !== 'BTC') : [],
      symbols: [...new Set([...held, 'PLTR', 'CRWD', 'PANW', 'MU'])],
    }));
    if (evalId) {
      const e = makeEntry({
        evalId, timestampMs: capturedAtMs - 5_000, total: SCORES[seq - 1], held: [],
        decision: seq === 16 ? 'SWAP' : 'HOLD',
        symbolOut: seq === 16 ? 'DE' : null, symbolIn: seq === 16 ? 'PLTR' : null,
        heardThread: seq >= 15 && !failed ? 'th-sep23' : null,
        candidates: CANDIDATES[seq] || null,
        rationale: failed ? 'Haiku call failed — defaulting to HOLD' : RATIONALE[seq][1],
        declarationsPhase: 'none',
      });
      e.scores = { active: SCORES[seq - 1] + 6, banked: -6, total: SCORES[seq - 1] };
      if (failed) {
        e.hypothesis = null;
        e.haikuError = { failureClass: 'timeout', message: 'model call timed out', timestamp: iso(capturedAtMs - 5_000), evalId };
        e.holdKind = 'default_failure';
        e.promptBuiltAt = iso(capturedAtMs - 13_000);
      } else {
        e.hypothesis = RATIONALE[seq][0];
        e.evidence = evidenceAtCheck(held, capturedAtMs - 13_000);
      }
      evaluations.push(e);
    }
    if (swap) held = held.map((s) => (s === swap[2] ? swap[3] : s));
  }
  const trades = SWAPS.map(([, ms, out, inn, tier, slotIndex, source, exitReason, locked]) => {
    const exitPrice = quoteAt(out, ms);
    return tradeOf({
      out, inn, tier, slotIndex, entryPrice: ENTRY_PRICE[out], exitPrice, lockedPoints: locked,
      lockedGainPct: r2(((exitPrice - ENTRY_PRICE[out]) / ENTRY_PRICE[out]) * 100), swappedOutAt: iso(ms), source, exitReason,
    });
  });
  const receipts = SWAPS.map(([, ms, out, inn, tier, slotIndex, source, exitReason], i) => receiptOf({
    battleId, out, inn, tier, slotIndex, swappedOutAt: iso(ms), source, exitReason,
    outgoingEntryPrice: ENTRY_PRICE[out], outgoingBaseATR: [4.1, 6.2, 5.3][i],
    thresholdHistory: { maxMultiplier: 0.12, minMultiplier: -0.31, badges: [] },
    entryMark: quoteAt(inn, ms), entryATR: [6.8, 3.9, 7.1][i], seq: i + 1,
  }));
  const battle = battleDoc({
    status: 'completed', completedAt: '2026-09-23T20:05:00.000Z',
    createdAt: '2026-09-23T12:00:00.000Z', activatedAt: '2026-09-23T12:00:00.000Z',
    timing: { tradingDays: [D], currentTradingDay: 1, timezone: 'America/New_York' },
    agentContext: {
      archetype: 'momentum', agentName: 'Momentum chaser',
      initialPortfolio: { star: [{ symbol: 'INTC' }, { symbol: 'AMD' }], core: [{ symbol: 'META' }, { symbol: 'ETN' }], support: [{ symbol: 'DE' }, { symbol: 'MSFT' }, { symbol: 'BTC', isCrypto: true }] },
    },
    portfolio: { startingPrices: { INTC: 31.24, AMD: 164.3, META: 612.4, ETN: 387.1, DE: 466.2, MSFT: 500.6, BTC: 71240 } },
    scoreState: { currentScore: -47, activeScore: -41, bankedScore: -6, opponentScore: -93, bankedBadgePoints: { total: 0 }, tradeCount: 3 },
    cronState: { tickSeq: 23 },
    evaluations,
    trades,
    statusFeed: [{ action: 'battle_complete', message: 'Battle complete. Agent: -47.0 pts vs CPU: -93.0 pts. Result: Win.', timestamp: '2026-09-23T20:05:00.000Z' }],
    chatExchanges: [
      {
        userMessage: 'Protect the lead into the close.', agentResponse: 'Heard. I will tighten the downside stop for the rest of the session.',
        hasDirective: true, directiveThreadId: 'th-sep23',
        directive: { text: 'Tighten the downside stop.', expiry: 'end_of_battle', directiveThreadId: 'th-sep23', adjustmentId: 'MC-tighten-stop', canonicalTextVersion: 1 },
        timestamp: iso(at(D, '17:40:00')), mode: 'battle',
        archetypeGate: { classification: 'in_archetype', selectedAdjustmentId: 'MC-tighten-stop', status: 'committed', repairUsed: false, originalUserAsk: 'PARAPHRASE-OF-PLAYER-1', counterOfferText: null, rejectionReason: null },
      },
      {
        userMessage: 'Sell everything right now.', agentResponse: 'That runs against how I trade; the plan stays as it is.',
        hasDirective: false, directiveThreadId: null, directive: null,
        timestamp: iso(at(D, '18:20:00')), mode: 'battle',
        archetypeGate: { classification: 'core_conflict', selectedAdjustmentId: null, status: 'no_change', repairUsed: false, originalUserAsk: 'PARAPHRASE-OF-PLAYER-2', counterOfferText: 'COUNTER-OFFER-TEXT', rejectionReason: 'REJECTION-REASON-TEXT' },
      },
      {
        userMessage: 'Tilt into chips for the last hour.', agentResponse: 'Done — a chip tilt is filed.',
        hasDirective: false, directiveThreadId: null, directive: null,
        timestamp: iso(at(D, '18:50:00')), mode: 'battle',
        archetypeGate: { classification: 'in_archetype', selectedAdjustmentId: 'MC-chip-tilt', status: 'fit_mismatch', repairUsed: false, originalUserAsk: 'PARAPHRASE-OF-PLAYER-3', counterOfferText: null, rejectionReason: null },
      },
    ],
  });
  return { battleId, etDate: D, battle, ticks, receipts, calls: [], declarations: [], runs: [], intradayViews: [{ id: `${battleId}:e12`, evaluatedAt: at(D, '17:00:15') }] };
}

/** A completed one-day battle with no checks; the opponent score never recorded; the platform's "Result: Draw.". */
export async function emptyDay({ battleId = 'b-empty-fixture' } = {}) {
  const D = EMPTY_DAY;
  const battle = battleDoc({
    status: 'completed', completedAt: '2026-09-28T20:05:00.000Z',
    createdAt: '2026-09-28T12:00:00.000Z', activatedAt: '2026-09-28T12:00:00.000Z',
    timing: { tradingDays: [D], currentTradingDay: 1, timezone: 'America/New_York' },
    agentContext: { archetype: 'momentum', agentName: 'Momentum chaser', initialPortfolio: { star: [], core: [], support: [] } },
    scoreState: { currentScore: 0, activeScore: 0, bankedScore: 0, bankedBadgePoints: { total: 0 }, tradeCount: 0 },
    cronState: { tickSeq: 0 },
    statusFeed: [{ action: 'battle_complete', message: 'Result: Draw.', timestamp: '2026-09-28T20:05:00.000Z' }],
  });
  delete battle.scoreState.opponentScore;
  return { battleId, etDate: D, battle, ticks: [], receipts: [], calls: [], declarations: [], runs: [], intradayViews: [] };
}

/**
 * Write a fixture day's tape at night and enrich it the next morning, through
 * the A1 passes. Returns the stored tape document and its series documents
 * (sorted by symbol), exactly as Firestore would hold them.
 */
export async function buildTapeDay(fx, { night, morning, bars }) {
  const store = seedDay({}, fx);
  for (const v of fx.intradayViews || []) store[`agentBattles/${fx.battleId}/intradayViews/${v.id}`] = { evaluatedAt: v.evaluatedAt, ownerId: OWNER };
  const t = makeTapeDb(store);
  await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: night });
  await runCandlePass({ db: t.db, fetchCandles: fetcherOf(bars).fetchCandles, clock: () => morning, startMs: morning });
  const tape = t.store.get(`agentBattles/${fx.battleId}/tape/${fx.etDate}`);
  const prefix = `agentBattles/${fx.battleId}/tape/${fx.etDate}/series/`;
  const series = [...t.store.entries()].filter(([k]) => k.startsWith(prefix)).map(([, v]) => v).sort((a, b) => (a.symbol < b.symbol ? -1 : 1));
  return { tape, series };
}

/** The two screen fixture days, built. */
export async function buildScreenFixtures() {
  const sep = await buildTapeDay(await sep23Day(), { night: SEP23_NIGHT, morning: SEP23_MORNING, bars: sep23Bars(SEP23) });
  const empty = await buildTapeDay(await emptyDay(), { night: EMPTY_NIGHT, morning: EMPTY_MORNING, bars: sep23Bars(EMPTY_DAY) });
  return { sep23: sep, empty };
}
