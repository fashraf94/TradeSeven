// api/_utils/filmTape/__fixtures__/tagFixtures.js
//
// Film Room B1 — fixture battle-days for the tagger and the tape additions,
// built the way tapeFixtures.js builds its days: every tick by the capture
// writer's own composer (makeTick), every evidence stamp by tickStamps.js's
// composeEvidenceStamp, the run records by the evaluator's composer, the entry
// envelope by makeEntry. Only the prices are chosen, so a holding's count can
// be walked by hand:
//
//   stalledDay — 2026-09-24, a `momentum_chaser` battle (forced rotation on:
//   pctThreshold 0.0015, ticksThreshold 5, winnerThreshold 0.0015,
//   maxTickAgeMinutes 20). Checks every 15 minutes from 13:30Z, each a model
//   check with an evaluation entry, except the `noTriggerSeqs` (no entry, so
//   no price). ACN barely moves and is down from entry: its count climbs one a
//   check from the second, and the platform's rule fires at `exitSeq` (the
//   tick records the stagnation verdict and the ACN → XOM swap). NVDA barely
//   moves but is UP from entry (a winner: never stalled). MSFT moves 0.4% a check.

import { composeEvidenceStamp } from '../../tickStamps.js';
import { makeTick, makeEntry, battleDoc, sessionRuns, tradeOf, receiptOf, STAGES_TO, CPU_OPPONENT } from './tapeFixtures.js';

const iso = (ms) => new Date(ms).toISOString();
const at = (date, hhmmss) => Date.parse(`${date}T${hhmmss}.000Z`);

export { CPU_OPPONENT };

/** The price and the change from entry the agent is shown for `sym` at check `seq`. */
export function quoteOf(sym, seq) {
  if (sym === 'ACN') return { current: 300 + (seq % 2) * 0.01, priceChange: -0.4 };
  if (sym === 'NVDA') return { current: 120, priceChange: 0.8 };
  if (sym === 'MSFT') return { current: Math.round(420 * (1 + 0.004 * seq) * 100) / 100, priceChange: 0.4 * seq };
  if (sym === 'XOM') return { current: Math.round(110 * (1 + 0.005 * seq) * 100) / 100, priceChange: 0.5 };
  return { current: 50, priceChange: 0 };
}

function evidenceAt(held, seq, riskStatus) {
  return composeEvidenceStamp({
    assetScores: held.map((s) => ({ symbol: s, priceChange: quoteOf(s, seq).priceChange, multiplier: 0.1 })),
    prices: Object.fromEntries(held.map((s) => [s, { current: quoteOf(s, seq).current }])),
    momentumData: { vwap: {}, rankings: {} },
    stockRegimes: {},
    riskStatus,
  });
}

/**
 * @param {object} [o]
 * @param {string} [o.archetype]           agentContext.archetype (a registry code-id, or not)
 * @param {number} [o.exitSeq]             the check whose tick records the stagnation exit (null: none)
 * @param {number[]} [o.noTriggerSeqs]     checks with no evaluation entry (no evidence)
 * @param {object|null} [o.dials]          agentContext.dials (the frozen desired tempo)
 * @param {object[]|null} [o.controlEpochLog]
 * @param {number|null} [o.controlEpoch]   every tick's controls.controlEpoch
 * @param {object|null} [o.opponent]       battle.opponent (the CPU opponent by default)
 * @param {object} [o.over]                more battle fields
 */
export async function stalledDay({
  battleId = 'b-stalled', archetype = 'momentum_chaser', exitSeq = 6, noTriggerSeqs = [], slots = 26,
  dials = null, controlEpochLog = null, controlEpoch = null, opponent = CPU_OPPONENT, over = {}, etDate = '2026-09-24',
} = {}) {
  const D = etDate;
  const ticks = [];
  const evaluations = [];
  let held = ['ACN', 'MSFT', 'NVDA'];
  // Check `seq` is captured at 13:30:20Z + 15 min per check; a swap happens inside its tick, 10 s before the capture.
  const capturedAt = (seq) => at(D, '13:30:20') + (seq - 1) * 15 * 60_000;
  const swapAt = exitSeq ? iso(capturedAt(exitSeq) - 10_000) : null;
  for (let seq = 1; seq <= slots; seq += 1) {
    const capturedAtMs = capturedAt(seq);
    const quiet = noTriggerSeqs.includes(seq);
    const kind = quiet ? 'no_trigger' : 'completed';
    const evalId = quiet ? null : `${battleId}:e${seq}`;
    const firing = seq === exitSeq;
    const verdicts = Object.fromEntries(held.map((s) => [s, firing && s === 'ACN' ? { action: 'SWAP_OUT', reason: 'stagnation' } : { action: 'HOLD', reason: null }]));
    const actions = firing ? [{ source: 'risk_manager', exitReason: 'stagnation', symbolOut: 'ACN', symbolIn: 'XOM', swappedOutAt: swapAt, lockedPoints: -2.5, entryPrice: 110 }] : [];
    ticks.push(await makeTick({
      battleId, tickSeq: seq, capturedAtMs, exitReason: kind, stages: STAGES_TO[kind], evalId,
      scores: { active: seq, banked: 0, total: seq, opponent: 2 * seq, bankedBadgePoints: 0 },
      verdicts, decision: quiet ? null : { original: 'HOLD', final: 'HOLD', holdKind: null },
      guardrail: { evaluated: false, deployedCount: 0 }, actions,
      controls: controlEpoch !== null ? { rendered: 'resolved', controlEpoch } : null,
      evidenceKeys: quiet ? [] : held, symbols: [...new Set([...held, 'XOM'])],
    }));
    if (!quiet) {
      const e = makeEntry({ evalId, timestampMs: capturedAtMs - 5_000, total: seq, held: [], declarationsPhase: 'none' });
      e.evidence = evidenceAt(held, seq, verdicts);
      evaluations.push(e);
    }
    if (firing) held = held.map((s) => (s === 'ACN' ? 'XOM' : s));
  }
  const battle = battleDoc({
    timing: { tradingDays: [D], currentTradingDay: 1, timezone: 'America/New_York' },
    cronState: { tickSeq: slots },
    agentContext: {
      archetype,
      ...(dials ? { dials } : {}),
      initialPortfolio: { star: [{ symbol: 'ACN' }], core: [{ symbol: 'MSFT' }], support: [{ symbol: 'NVDA' }] },
    },
    portfolio: { startingPrices: { ACN: 301.2, MSFT: 418, NVDA: 119 } },
    // null: a battle created with no CPU opponent, as createAgentBattle writes it (`opponent: options.opponent || null`)
    opponent: opponent ? structuredClone(opponent) : null,
    ...(controlEpochLog ? { controlEpochLog } : {}),
    evaluations,
    trades: exitSeq ? [tradeOf({ out: 'ACN', inn: 'XOM', tier: 'star', slotIndex: 0, entryPrice: 301.2, exitPrice: 300, lockedPoints: -2.5, lockedGainPct: -0.4, swappedOutAt: swapAt, source: 'risk_manager', exitReason: 'stagnation' })] : [],
    ...over,
  });
  const receipts = exitSeq ? [receiptOf({ battleId, out: 'ACN', inn: 'XOM', tier: 'star', slotIndex: 0, swappedOutAt: swapAt, source: 'risk_manager', exitReason: 'stagnation', outgoingEntryPrice: 301.2, outgoingBaseATR: 1.8, thresholdHistory: { maxMultiplier: 0.1, minMultiplier: -0.3, badges: [] }, entryMark: 110, entryATR: 2.1, seq: 1 })] : [];
  return { battleId, etDate: D, battle, ticks, receipts, calls: [], declarations: [], runs: sessionRuns(D), swapAt };
}

/** A control-epoch log entry as buildControlEpochLogEntry writes it (controlSuppressionTelemetry.js). */
export const epochEntry = (tempoDialEnabled, at = '2026-09-24T12:00:00.000Z') => ({
  epochKey: `integrity=off|leans=off|dial=${tempoDialEnabled ? 'on' : 'off'}`,
  modes: { archetypeIntegrityMode: 'off', standingLeansEnabled: false, tempoDialEnabled },
  suppressedDirectiveIds: [], suppressedLeanIds: [], at,
});
